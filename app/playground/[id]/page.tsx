"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import LoadingStep from "@/modules/playground/components/loader";
import {PlaygroundEditor} from "@/modules/playground/components/playground-editor";
import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";
import ToggleAI from "@/modules/playground/components/toggle-ai";
import { AIChatSidePanel } from "@/modules/ai-chat/components/ai-chat-sidebarpanel";
import { AISettingsDialog } from "@/modules/playground/components/dialogs/ai-settings-dialog";
import { useAISuggestions } from "@/modules/playground/hooks/useAISuggestion";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import { usePlayground } from "@/modules/playground/hooks/usePlayground";
import { findFilePath, generateFileId } from "@/modules/playground/lib";
import {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";
import dynamic from "next/dynamic";
import Link from "next/link";
const TerminalComponent = dynamic(
  () => import("@/modules/webcontainers/components/terminal"),
  { ssr: false }
);
import { useServerWorkspace } from "@/modules/playground/hooks/useServerWorkspace";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  FileText,
  FolderOpen,
  Save,
  Settings,
  X,
  Eye,
  Terminal,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const MainPlaygroundPage = () => {
  const { id } = useParams<{ id: string }>();
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [isAIChatVisible, setIsAIChatVisible] = useState(false);
  const mainPanelRef = useRef<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [isGuideVisible, setIsGuideVisible] = useState(false);

  useEffect(() => {
    if (mainPanelRef.current) {
      if (isAIChatVisible) {
        mainPanelRef.current.resize(70);
      } else {
        mainPanelRef.current.resize(100);
      }
    }
  }, [isAIChatVisible]);

  useEffect(() => {
    const handleReset = () => {
      setPreviewUrl(null);
      setIsServerRunning(false);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("terminal-reset", handleReset);
      return () => window.removeEventListener("terminal-reset", handleReset);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workspace/tunnel?id=${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setPreviewUrl(data.url);
            setIsServerRunning(true);
          } else {
            setPreviewUrl(null);
            const scanResults = data.debug?.scanResults;
            const hasActivePort = scanResults && Object.values(scanResults).some((val) => val === true);
            setIsServerRunning(!!hasActivePort);
          }
        } else {
          setPreviewUrl(null);
          setIsServerRunning(false);
        }
      } catch (error) {
        setPreviewUrl(null);
        setIsServerRunning(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [id]);

  const { playgroundData, templateData, isLoading, error, saveTemplateData } =
    usePlayground(id);

    const aiSuggestions = useAISuggestions();

  const {
    setTemplateData,
    setActiveFileId,
    setPlaygroundId,
    setOpenFiles,
    activeFileId,
    closeAllFiles,
    closeFile,
    openFile,
    openFiles,

    handleAddFile,
    handleAddFolder,
    handleDeleteFile,
    handleDeleteFolder,
    handleRenameFile,
    handleRenameFolder,
    updateFileContent
  } = useFileExplorer();

  const {
    serverUrl,
    isLoading: containerLoading,
    error: containerError,
    instance,
    writeFileSync,
  } = useServerWorkspace({ templateData: templateData!, id });

  const lastSyncedContent = useRef<Map<string, string>>(new Map());

  const [filesMounted, setFilesMounted] = useState(false);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (
        event.message &&
        (event.message.includes("dimensions") || 
         event.message.includes("reading 'dimensions'") ||
         event.message.includes("clear"))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message &&
        (event.reason.message.includes("dimensions") || 
         event.reason.message.includes("reading 'dimensions'"))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", handleGlobalError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);
    return () => {
      window.removeEventListener("error", handleGlobalError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
    };
  }, []);

  useEffect(() => {
    setFilesMounted(false);
  }, [id, instance]);

  // Poll workspace disk to sync file tree changes (from terminal compiling or script generation)
  useEffect(() => {
    if (!id || !instance) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workspace/files?id=${id}&action=sync`);
        if (res.ok) {
          const data = await res.json();
          if (data.templateData) {
            setTemplateData(data.templateData);
          }
        }
      } catch (error) {
        // Suppress background sync fetch errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, instance, setTemplateData]);

  useEffect(() => {
    setPlaygroundId(id);
  }, [id, setPlaygroundId]);

  useEffect(() => {
    if (templateData && !openFiles.length) {
      setTemplateData(templateData);
    }
  }, [templateData, setTemplateData, openFiles.length]);

  // Create wrapper functions that pass saveTemplateData
  const wrappedHandleAddFile = useCallback(
    (newFile: TemplateFile, parentPath: string) => {
      return handleAddFile(
        newFile,
        parentPath,
        writeFileSync!,
        instance,
        saveTemplateData
      );
    },
    [handleAddFile, writeFileSync, instance, saveTemplateData]
  );

  const wrappedHandleAddFolder = useCallback(
    (newFolder: TemplateFolder, parentPath: string) => {
      return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
    },
    [handleAddFolder, instance, saveTemplateData]
  );

  const wrappedHandleDeleteFile = useCallback(
    (file: TemplateFile, parentPath: string) => {
      return handleDeleteFile(file, parentPath, saveTemplateData);
    },
    [handleDeleteFile, saveTemplateData]
  );

  const wrappedHandleDeleteFolder = useCallback(
    (folder: TemplateFolder, parentPath: string) => {
      return handleDeleteFolder(folder, parentPath, saveTemplateData);
    },
    [handleDeleteFolder, saveTemplateData]
  );

  const wrappedHandleRenameFile = useCallback(
    (
      file: TemplateFile,
      newFilename: string,
      newExtension: string,
      parentPath: string
    ) => {
      return handleRenameFile(
        file,
        newFilename,
        newExtension,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFile, saveTemplateData]
  );

  const wrappedHandleRenameFolder = useCallback(
    (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
      return handleRenameFolder(
        folder,
        newFolderName,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFolder, saveTemplateData]
  );

  const activeFile = openFiles.find((file) => file.id === activeFileId);
  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

  const handleFileSelect = async (file: TemplateFile) => {
    let fileToOpen = { ...file };
    if (instance) {
      const fileId = generateFileId(file, templateData!);
      try {
        const actualContent = await instance.fs.readFile(fileId, "utf8");
        fileToOpen.content = actualContent;
      } catch (err) {
        console.error("Failed to read file content from container:", fileId, err);
      }
    }
    openFile(fileToOpen);
  };

  const handleSave = useCallback(
    async (fileId?: string) => {
      const targetFileId = fileId || activeFileId;
      if (!targetFileId) return;

      const fileToSave = openFiles.find((f) => f.id === targetFileId);

      if (!fileToSave) return;

      const latestTemplateData = useFileExplorer.getState().templateData;
      if (!latestTemplateData) return

      try {
        let folderPath = findFilePath(fileToSave, latestTemplateData);
        let filePath = "";
        let isSandboxFile = false;
        if (folderPath !== null) {
          const ext = fileToSave.fileExtension?.trim();
          filePath = folderPath ? `${folderPath}/${fileToSave.filename}${ext ? `.${ext}` : ""}` : `${fileToSave.filename}${ext ? `.${ext}` : ""}`;
        } else {
          filePath = targetFileId;
          isSandboxFile = true;
        }

        if (isSandboxFile) {
          if (instance && instance.fs) {
            await instance.fs.writeFile(filePath, fileToSave.content);
          }
        } else {
          const updatedTemplateData = JSON.parse(
            JSON.stringify(latestTemplateData)
          );

          // @ts-ignore
          const updateFileContent = (items: any[]) =>
            // @ts-ignore
            items.map((item) => {
              if ("folderName" in item) {
                return { ...item, items: updateFileContent(item.items) };
              } else if (
                item.filename === fileToSave.filename &&
                item.fileExtension === fileToSave.fileExtension
              ) {
                return { ...item, content: fileToSave.content };
              }
              return item;
            });
          updatedTemplateData.items = updateFileContent(
            updatedTemplateData.items
          );

          // Sync with WebContainer
          if (writeFileSync) {
            await writeFileSync(filePath, fileToSave.content);
            lastSyncedContent.current.set(fileToSave.id, fileToSave.content);
            if (instance && instance.fs) {
              await instance.fs.writeFile(filePath, fileToSave.content);
            }
          }

          await saveTemplateData(updatedTemplateData);
          setTemplateData(updatedTemplateData);
        }
// Update open files
        const updatedOpenFiles = openFiles.map((f) =>
          f.id === targetFileId
            ? {
                ...f,
                content: fileToSave.content,
                originalContent: fileToSave.content,
                hasUnsavedChanges: false,
              }
            : f
        );
        setOpenFiles(updatedOpenFiles);

        if (isSandboxFile) {
          await syncFileSystemFromContainer();
        }

    toast.success(
          `Saved ${fileToSave.filename}.${fileToSave.fileExtension}`
        );
      } catch (error) {
         console.error("Error saving file:", error);
        toast.error(
          `Failed to save ${fileToSave.filename}.${fileToSave.fileExtension}`
        );
        throw error;
      }
    },
    [
      activeFileId,
      openFiles,
      writeFileSync,
      instance,
      saveTemplateData,
      setTemplateData,
      setOpenFiles,
    ]
  );

    const handleSaveAll = async () => {
    const unsavedFiles = openFiles.filter((f) => f.hasUnsavedChanges);

    if (unsavedFiles.length === 0) {
      toast.info("No unsaved changes");
      return;
    }

    try {
      await Promise.all(unsavedFiles.map((f) => handleSave(f.id)));
      toast.success(`Saved ${unsavedFiles.length} file(s)`);
    } catch (error) {
      toast.error("Failed to save some files");
    }
  };

  const syncFileSystemFromContainer = useCallback(async () => {
    if (!instance) {
      toast.info("WebContainer is not ready yet");
      return;
    }

    try {
      const readDir = async (dirPath: string = ""): Promise<any[]> => {
        const entries = await instance.fs.readdir(dirPath, { withFileTypes: true });
        const items = [];

        for (const entry of entries) {
          const name = entry.name;
          const fullPath = dirPath ? `${dirPath}/${name}` : name;

          if (
            name === "node_modules" ||
            name === ".next" ||
            name === "dist" ||
            name === "out" ||
            name === ".git" ||
            name === ".turbo"
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            const subItems = await readDir(fullPath);
            items.push({
              folderName: name,
              items: subItems,
            });
          } else {
            const content = await instance.fs.readFile(fullPath, "utf8");
            const lastDot = name.lastIndexOf(".");
            const filename = lastDot === -1 ? name : name.substring(0, lastDot);
            const fileExtension = lastDot === -1 ? "" : name.substring(lastDot + 1);

            items.push({
              filename,
              fileExtension,
              content,
            });
          }
        }

        return items;
      };

      const rootItems = await readDir("");
      const updatedTemplateData = {
        folderName: "Root",
        items: rootItems,
      };

      await saveTemplateData(updatedTemplateData);
      setTemplateData(updatedTemplateData);
      toast.success("File explorer synced with sandbox successfully");
    } catch (err) {
      console.error("Failed to sync container files:", err);
      toast.error("Failed to sync file explorer");
    }
  }, [instance, saveTemplateData, setTemplateData]);


  useEffect(()=>{
    const handleKeyDown = (e:KeyboardEvent)=>{
      if(e.ctrlKey && e.key === "s"){
        e.preventDefault()
        handleSave()
      }
    }
     window.addEventListener("keydown", handleKeyDown);
     return () => window.removeEventListener("keydown", handleKeyDown);
  },[handleSave]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="destructive">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="w-full max-w-md p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Loading Playground
          </h2>
          <div className="mb-8">
            <LoadingStep
              currentStep={1}
              step={1}
              label="Loading playground data"
            />
            <LoadingStep
              currentStep={2}
              step={2}
              label="Setting up environment"
            />
            <LoadingStep currentStep={3} step={3} label="Ready to code" />
          </div>
        </div>
      </div>
    );
  }

  // No template data
  if (!templateData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <FolderOpen className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-amber-600 mb-2">
          No template data available
        </h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Template
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <>
        <TemplateFileTree
          data={templateData!}
          instance={filesMounted ? instance : null}
          onFileSelect={handleFileSelect}
          selectedFile={activeFile}
          title="File Explorer"
          onAddFile={wrappedHandleAddFile}
          onAddFolder={wrappedHandleAddFolder}
          onDeleteFile={wrappedHandleDeleteFile}
          onDeleteFolder={wrappedHandleDeleteFolder}
          onRenameFile={wrappedHandleRenameFile}
          onRenameFolder={wrappedHandleRenameFolder}
          onSync={syncFileSystemFromContainer}
        />
        <SidebarInset className="!w-0 !min-w-0 flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                  <Link href="/dashboard">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Dashboard</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="mr-2 h-4" />

            <div className="flex flex-1 items-center gap-2">
              <div className="flex flex-col flex-1">
                <h1 className="text-sm font-medium">
                  {playgroundData?.title || "Code Playground"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {openFiles.length} File(s) Open
                  {hasUnsavedChanges && " • Unsaved changes"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave()}
                      disabled={!activeFile || !activeFile.hasUnsavedChanges}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save (Ctrl+S)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveAll}
                      disabled={!hasUnsavedChanges}
                    >
                      <Save className="h-4 w-4" /> All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save All (Ctrl+Shift+S)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    {previewUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-emerald-950/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-900/40 hover:text-emerald-300 gap-1.5 transition-colors flex items-center"
                        asChild
                      >
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4" />
                          <span>Open Preview</span>
                        </a>
                      </Button>
                    ) : isServerRunning ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="bg-amber-950/20 text-amber-500 border-amber-500/20 gap-1.5 animate-pulse cursor-wait flex items-center opacity-100"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Connecting Preview...</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="text-zinc-500 border-zinc-800 bg-zinc-950/20 gap-1.5 cursor-not-allowed flex items-center opacity-60"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview Offline</span>
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {previewUrl 
                      ? "Open your running web preview" 
                      : isServerRunning 
                      ? "Setting up your secure public preview link..." 
                      : "Preview is offline. Start a server (e.g. npm run dev) to enable."}
                  </TooltipContent>
                </Tooltip>

               <ToggleAI
                isEnabled={aiSuggestions.isEnabled}
                onToggle={aiSuggestions.toggleEnabled}
                suggestionLoading={aiSuggestions.isLoading}
                onOpenChat={() => setIsAIChatVisible(!isAIChatVisible)}
               />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={isAIChatVisible ? "default" : "outline"}
                      onClick={() => setIsAIChatVisible(!isAIChatVisible)}
                      className="gap-1.5"
                    >
                      <Bot className="h-4 w-4" />
                      <span>AI Chat</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle AI Chat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={isTerminalVisible ? "default" : "outline"}
                      onClick={() => setIsTerminalVisible(!isTerminalVisible)}
                      className="gap-1.5"
                    >
                      <Terminal className="h-4 w-4" />
                      <span>Terminal</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Terminal</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setIsTerminalVisible(!isTerminalVisible)}
                    >
                      {isTerminalVisible ? "Hide" : "Show"} Terminal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={closeAllFiles}>
                      Close All Files
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div className="h-[calc(100vh-4rem)]">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel ref={mainPanelRef} defaultSize={isAIChatVisible ? 70 : 100} minSize={30}>
                {openFiles.length > 0 ? (
                  <div className="h-full flex flex-col">
                    <div className="border-b bg-muted/30">
                      <Tabs
                        value={activeFileId || ""}
                        onValueChange={setActiveFileId}
                      >
                        <div className="flex items-center justify-between px-4 py-2">
                          <TabsList className="h-8 bg-transparent p-0">
                            {openFiles.map((file) => (
                              <TabsTrigger
                                key={file.id}
                                value={file.id}
                                className="relative h-8 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm group"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3 w-3" />
                                  <span>
                                    {file.filename}.{file.fileExtension}
                                  </span>
                                  {file.hasUnsavedChanges && (
                                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                                  )}
                                  <span
                                    className="ml-2 h-4 w-4 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      closeFile(file.id);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </span>
                                </div>
                              </TabsTrigger>
                            ))}
                          </TabsList>

                          {openFiles.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={closeAllFiles}
                              className="h-6 px-2 text-xs"
                            >
                              Close All
                            </Button>
                          )}
                        </div>
                      </Tabs>
                    </div>
                    <div className="flex-1">
                      <ResizablePanelGroup
                        direction="vertical"
                        className="h-full"
                      >
                        <ResizablePanel defaultSize={isTerminalVisible ? 60 : 100} minSize={20}>
                          <PlaygroundEditor
                            activeFile={activeFile}
                            content={activeFile?.content || ""}
                            onContentChange={(value) => 
                              activeFileId && updateFileContent(activeFileId , value)
                            }
                            suggestion={aiSuggestions.suggestion}
                            suggestionLoading={aiSuggestions.isLoading}
                            suggestionPosition={aiSuggestions.position}
                            onAcceptSuggestion={(editor , monaco)=>aiSuggestions.acceptSuggestion(editor , monaco)}

                              onRejectSuggestion={(editor) =>
                              aiSuggestions.rejectSuggestion(editor)
                            }
                            onTriggerSuggestion={(type, editor) =>
                              aiSuggestions.fetchSuggestion(type, editor)
                            }
                          />
                        </ResizablePanel>

                        {isTerminalVisible && (
                          <>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={40} minSize={15}>
                              <div className="flex h-full w-full bg-[#09090B] border border-zinc-800 rounded-lg overflow-hidden">
                                <div className="flex-1 min-w-0">
                                  <TerminalComponent
                                    webContainerInstance={instance}
                                    theme="dark"
                                    className="h-full border-0 rounded-none"
                                    isGuideVisible={isGuideVisible}
                                    onToggleGuide={() => setIsGuideVisible(!isGuideVisible)}
                                  />
                                </div>
                                {isGuideVisible && (
                                  <div className="w-80 shrink-0 border-l border-zinc-800 p-4 bg-zinc-950/60 overflow-y-auto flex flex-col gap-4 text-xs select-none">
                                    <div className="flex items-center gap-1.5 text-zinc-400 font-medium pb-2 border-b border-zinc-800">
                                      <Bot className="h-4 w-4 text-emerald-400" />
                                      <span>DevPilot Terminal Guide</span>
                                    </div>
                                    <div className="flex flex-col gap-3 text-zinc-400">
                                      <div className="flex gap-2">
                                        <span className="text-zinc-500 font-bold">1.</span>
                                        <p>
                                          To stop or kill any active command or web server, delete the session by clicking the **bin icon** on the top-right corner of the terminal bar.
                                        </p>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="text-zinc-500 font-bold">2.</span>
                                        <p>
                                          When you start a development server (like `npm run dev`), DevPilot automatically tunnels it to a secure live preview URL. The **Open Preview** button in the header toolbar will turn orange while loading, then green when the site is ready to view.
                                        </p>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className="text-zinc-500 font-bold">3.</span>
                                        <p>
                                          When starting a development project (such as React or Vue) for the first time, run the installation command (`npm install`) once to download all package dependencies before starting the server.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </ResizablePanel>
                          </>
                        )}
                      </ResizablePanelGroup>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-4">
                    <FileText className="h-16 w-16 text-gray-300" />
                    <div className="text-center">
                      <p className="text-lg font-medium">No files open</p>
                      <p className="text-sm text-gray-500">
                        Select a file from the sidebar to start editing
                      </p>
                    </div>
                  </div>
                )}
              </ResizablePanel>
              {isAIChatVisible && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={30} minSize={20} className="border-l border-zinc-800 bg-zinc-950">
                    <AIChatSidePanel
                      isOpen={isAIChatVisible}
                      onClose={() => setIsAIChatVisible(false)}
                      inline={true}
                      playgroundId={id}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
          <AISettingsDialog />
        </SidebarInset>
      </>
    </TooltipProvider>
  );
};

export default MainPlaygroundPage;
