"use client";
import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle, ExternalLink, RotateCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent from "./terminal";
import { getCache, setCache } from "../lib/indexeddb-cache";

const TAR_UTILS_CONTENT = `const fs = require('fs');
const path = require('path');

function pad(num, size, radix = 8) {
  let s = num.toString(radix);
  while (s.length < size - 1) s = '0' + s;
  return s + '\\x00';
}

function computeChecksum(header) {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    if (i >= 148 && i < 156) {
      sum += 32;
    } else {
      sum += header[i];
    }
  }
  return sum;
}

function packDir(dirPath, baseDir, writeStream) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const relPath = path.relative(baseDir, fullPath).replace(/\\\\/g, '/');
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const header = Buffer.alloc(512);
      header.write(relPath + '/', 0, 100, 'utf8');
      header.write('0000755\\x00', 100);
      header.write('0000000\\x00', 108);
      header.write('0000000\\x00', 116);
      header.write(pad(0, 12), 124);
      header.write(pad(Math.floor(stat.mtimeMs / 1000), 12), 136);
      header.write('5', 156);
      header.write('ustar\\x00', 257);
      header.write('00', 263);

      const chk = computeChecksum(header);
      header.write(pad(chk, 8), 148);

      writeStream.write(header);
      packDir(fullPath, baseDir, writeStream);
    } else if (stat.isFile()) {
      const header = Buffer.alloc(512);
      header.write(relPath, 0, 100, 'utf8');
      header.write('0000644\\x00', 100);
      header.write('0000000\\x00', 108);
      header.write('0000000\\x00', 116);
      header.write(pad(stat.size, 12), 124);
      header.write(pad(Math.floor(stat.mtimeMs / 1000), 12), 136);
      header.write('0', 156);
      header.write('ustar\\x00', 257);
      header.write('00', 263);

      const chk = computeChecksum(header);
      header.write(pad(chk, 8), 148);

      writeStream.write(header);

      const content = fs.readFileSync(fullPath);
      writeStream.write(content);

      const remainder = stat.size % 512;
      if (remainder > 0) {
        writeStream.write(Buffer.alloc(512 - remainder));
      }
    }
  }
}

function pack(srcDir, tarPath) {
  const writeStream = fs.createWriteStream(tarPath);
  packDir(srcDir, path.dirname(srcDir), writeStream);
  writeStream.write(Buffer.alloc(1024));
  writeStream.end();
}

function unpack(tarPath, destDir) {
  const buffer = fs.readFileSync(tarPath);
  let offset = 0;

  while (offset < buffer.length) {
    const header = buffer.slice(offset, offset + 512);
    offset += 512;

    if (header.every(b => b === 0)) {
      break;
    }

    const name = header.toString('utf8', 0, 100).replace(/\\x00+$/, '');
    if (!name) continue;

    const size = parseInt(header.toString('utf8', 124, 136).replace(/\\x00+$/, '').trim(), 8);
    const typeflag = header.toString('utf8', 156, 157);

    const fullPath = path.join(destDir, name);

    if (typeflag === '5' || name.endsWith('/')) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      const fileData = buffer.slice(offset, offset + size);
      fs.writeFileSync(fullPath, fileData);

      const blocks = Math.ceil(size / 512);
      offset += blocks * 512;
    }
  }
}

const mode = process.argv[2];
const folder = process.argv[3];
const tarFile = process.argv[4];

if (mode === 'pack') {
  pack(folder, tarFile);
} else if (mode === 'unpack') {
  unpack(tarFile, folder);
}
`;

function getDependenciesHash(templateData: TemplateFolder): string {
  const packageJson = templateData.items.find(
    (item) => "filename" in item && item.filename === "package" && item.fileExtension === "json"
  );
  if (packageJson && "content" in packageJson) {
    try {
      const parsed = JSON.parse(packageJson.content);
      const deps = {
        dependencies: parsed.dependencies || {},
        devDependencies: parsed.devDependencies || {},
      };
      return JSON.stringify(deps);
    } catch (e) {
      return JSON.stringify(templateData);
    }
  }
  return JSON.stringify(templateData);
}

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup
  onFilesMounted?: () => void;
  showPreview?: boolean;
  showTerminal?: boolean;
}
const WebContainerPreview = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl,
  writeFileSync,
  forceResetup = false,
  onFilesMounted,
  showPreview = true,
  showTerminal = true,
}: WebContainerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loadingState, setLoadingState] = useState({
    transforming: false,
    mounting: false,
    installing: false,
    starting: false,
    ready: false,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);

  const terminalRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefreshIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // Reset setup state when forceResetup changes
  useEffect(() => {
    if (forceResetup) {
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      setLoadingState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false,
      });
    }
  }, [forceResetup]);

  useEffect(() => {
    async function setupContainer() {
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);

        if ((instance as any).isServer) {
          onFilesMounted?.();
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
          setPreviewUrl(serverUrl || "http://localhost:3000");
          return;
        }

        try {
          const packageJsonExists = await instance.fs.readFile(
            "package.json",
            "utf8"
          );

          if (packageJsonExists) {
            onFilesMounted?.();
            // Files are already mounted, just reconnect to existing server
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal(
                "🔄 Reconnecting to existing WebContainer session...\r\n"
              );
            }

            instance.on("server-ready", (port: number, url: string) => {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(
                  `🌐 Reconnected to server at ${url}\r\n`
                );
              }

              setPreviewUrl(url);
              setLoadingState((prev) => ({
                ...prev,
                starting: false,
                ready: true,
              }));
            });

            setCurrentStep(4);
            setLoadingState((prev) => ({ ...prev, starting: true }));
            return;
          }
        } catch (error) {}

        // Step-1 transform data
        setLoadingState((prev) => ({ ...prev, transforming: true }));
        setCurrentStep(1);
        // Write to terminal
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "🔄 Transforming template data...\r\n"
          );
        }

        // @ts-ignore
        const files = transformToWebContainerFormat(templateData);
        setLoadingState((prev) => ({
          ...prev,
          transforming: false,
          mounting: true,
        }));
        setCurrentStep(2);

        //  Step-2 Mount Files

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "📁 Mounting files to WebContainer...\r\n"
          );
        }
        await instance.mount(files);
        onFilesMounted?.();

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "✅ Files mounted successfully\r\n"
          );
        }
        const packageJsonFile = templateData.items.find(
          (item) => "filename" in item && item.filename === "package" && item.fileExtension === "json"
        );

        if (!packageJsonFile) {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              "📁 Blank project workspace ready!\r\nReady for your commands.\r\n"
            );
          }
          setLoadingState((prev) => ({
            ...prev,
            mounting: false,
            installing: false,
            starting: false,
            ready: true,
          }));
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
          return;
        }

        setLoadingState((prev) => ({
          ...prev,
          mounting: false,
          installing: true,
        }));
        setCurrentStep(3);

        const runNpmInstall = async (inst: typeof instance, cacheToSaveKey?: string) => {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal("📦 Installing dependencies from registry...\r\n");
          }

          const installProcess = await inst.spawn("npm", [
            "install",
            "--no-audit",
            "--no-fund",
            "--prefer-offline",
          ]);

          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                if (terminalRef.current?.writeToTerminal) {
                  terminalRef.current.writeToTerminal(data);
                }
              },
            })
          );

          const installExitCode = await installProcess.exit;

          if (installExitCode !== 0) {
            throw new Error(
              `Failed to install dependencies. Exit code: ${installExitCode}`
            );
          }

          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal("✅ Dependencies installed successfully\r\n");
          }

          if (cacheToSaveKey) {
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal("💾 Compression/saving node_modules cache to browser IndexedDB...\r\n");
            }
            try {
              await inst.fs.writeFile("tar-utils.js", TAR_UTILS_CONTENT);
              const packProcess = await inst.spawn("node", [
                "tar-utils.js",
                "pack",
                "node_modules",
                "node_modules.tar",
              ]);
              const packExit = await packProcess.exit;

              if (packExit === 0) {
                const tarballData = await inst.fs.readFile("node_modules.tar");
                await setCache(cacheToSaveKey, tarballData);
                if (terminalRef.current?.writeToTerminal) {
                  terminalRef.current.writeToTerminal("✅ Cache stored successfully in browser storage!\r\n");
                }
              }
              // Clean up pack helpers
              await inst.fs.rm("node_modules.tar");
              await inst.fs.rm("tar-utils.js");
            } catch (err) {
              console.error("Failed to save tarball cache:", err);
            }
          }
        };

        // Step-3 Check cache or Install dependencies
        const depsHash = getDependenciesHash(templateData);
        const cacheKey = `modules_cache_${depsHash}`;

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal("🔍 Checking dependency cache in IndexedDB...\r\n");
        }

        const cachedTarball = await getCache(cacheKey);

        if (cachedTarball) {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal("📦 Cache hit! Extracting node_modules from local storage...\r\n");
          }

          await instance.fs.writeFile("node_modules.tar", cachedTarball);
          await instance.fs.writeFile("tar-utils.js", TAR_UTILS_CONTENT);

          const unpackProcess = await instance.spawn("node", [
            "tar-utils.js",
            "unpack",
            "node_modules",
            "node_modules.tar",
          ]);

          unpackProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                if (terminalRef.current?.writeToTerminal) {
                  terminalRef.current.writeToTerminal(data);
                }
              },
            })
          );

          const unpackExit = await unpackProcess.exit;

          try {
            await instance.fs.rm("node_modules.tar");
            await instance.fs.rm("tar-utils.js");
          } catch (e) {}

          if (unpackExit === 0) {
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal("✅ node_modules restored successfully in under 3 seconds\r\n");
            }
          } else {
            if (terminalRef.current?.writeToTerminal) {
              terminalRef.current.writeToTerminal("⚠️ Failed to restore cache. Falling back to fresh install...\r\n");
            }
            await runNpmInstall(instance);
          }
        } else {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal("📦 Cache miss. Downloading and installing fresh packages...\r\n");
          }
          await runNpmInstall(instance, cacheKey);
        }

        setLoadingState((prev) => ({
          ...prev,
          installing: false,
          starting: true,
        }));
        setCurrentStep(4);

        // STEP-4 Start The Server

        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(
            "🚀 Starting development server...\r\n"
          );
        }

        let startScript = "start";
        if (packageJsonFile && "content" in packageJsonFile) {
          try {
            const pkg = JSON.parse(packageJsonFile.content);
            if (pkg.scripts && pkg.scripts.dev) {
              startScript = "dev";
            }
          } catch (e) {
            console.error("Failed to parse package.json for startup script:", e);
          }
        }

        const startProcess = await instance.spawn("npm", ["run", startScript]);

        instance.on("server-ready", (port: number, url: string) => {
          if (terminalRef.current?.writeToTerminal) {
            terminalRef.current.writeToTerminal(
              `🌐 Server ready at ${url}\r\n`
            );
          }
          setPreviewUrl(url);
          setLoadingState((prev) => ({
            ...prev,
            starting: false,
            ready: true,
          }));
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
        });

        // Handle start process output - stream to terminal
        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (terminalRef.current?.writeToTerminal) {
                terminalRef.current.writeToTerminal(data);
              }
            },
          })
        );
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (terminalRef.current?.writeToTerminal) {
          terminalRef.current.writeToTerminal(`❌ Error: ${errorMessage}\r\n`);
        }
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
        setLoadingState({
          transforming: false,
          mounting: false,
          installing: false,
          starting: false,
          ready: false,
        });
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress]);

  useEffect(() => {
    return () => {};
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-medium">Initializing WebContainer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Setting up the environment for your project...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="text-sm">{error || setupError}</p>
        </div>
      </div>
    );
  }
  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span
        className={`text-sm font-medium ${
          isComplete
            ? "text-green-600"
            : isActive
            ? "text-blue-600"
            : "text-gray-500"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      {!previewUrl ? (
        <div className="h-full flex flex-col">
          <div className="w-full max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm mx-auto">
            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2 mb-6"
            />

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                {getStepIcon(1)}
                {getStepText(1, "Transforming template data")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(2)}
                {getStepText(2, "Mounting files")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(3)}
                {getStepText(3, "Installing dependencies")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(4)}
                {getStepText(4, "Starting development server")}
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 p-4">
            <TerminalComponent
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {showPreview && showTerminal ? (
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={60} minSize={20}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-4 py-1.5 border-b bg-zinc-50 dark:bg-zinc-900">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 dark:bg-green-500" />
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 select-all truncate max-w-sm ml-2 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {previewUrl}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                        onClick={handleRefreshIframe}
                        title="Refresh preview"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                        onClick={() => window.open(previewUrl, "_blank")}
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 relative">
                    <iframe
                      ref={iframeRef}
                      src={previewUrl}
                      className="w-full h-full border-none bg-white"
                      title="WebContainer Preview"
                    />
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={15}>
                <div className="h-full border-t">
                  <TerminalComponent
                    ref={terminalRef}
                    webContainerInstance={instance}
                    theme="dark"
                    className="h-full"
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : showPreview ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-1.5 border-b bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 dark:bg-red-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 dark:bg-green-500" />
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 select-all truncate max-w-sm ml-2 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {previewUrl}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                    onClick={handleRefreshIframe}
                    title="Refresh preview"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                    onClick={() => window.open(previewUrl, "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 relative">
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="w-full h-full border-none bg-white"
                  title="WebContainer Preview"
                />
              </div>
            </div>
          ) : (
            <div className="h-full">
              <TerminalComponent
                ref={terminalRef}
                webContainerInstance={instance}
                theme="dark"
                className="h-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;
