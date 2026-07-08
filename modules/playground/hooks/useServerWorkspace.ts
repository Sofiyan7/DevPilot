import { useState, useEffect, useCallback } from "react";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";

interface UseServerWorkspaceProps {
  templateData: TemplateFolder;
  id: string;
}

interface UseServerWorkspaceReturn {
  serverUrl: string | null;
  isLoading: boolean;
  error: string | null;
  instance: any;
  writeFileSync: (path: string, content: string) => Promise<void>;
  destory: () => void;
}

export const useServerWorkspace = ({
  templateData,
  id,
}: UseServerWorkspaceProps): UseServerWorkspaceReturn => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeWorkspace() {
      if (!id) return;
      try {
        setIsLoading(true);
        // Call init endpoint to write files on disk
        const res = await fetch(`/api/workspace/files?id=${id}&action=init`);
        if (!res.ok) {
          throw new Error(await res.text());
        }

        if (!mounted) return;

        // Construct mock container instance mapping filesystem endpoints
        const mockInstance = {
          isServer: true,
          id,
          fs: {
            readdir: async (dirPath: string, options?: any) => {
              const res = await fetch(
                `/api/workspace/files?id=${id}&action=readdir&path=${encodeURIComponent(dirPath)}`
              );
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              return data.entries.map((e: any) => ({
                name: e.name,
                isDirectory: () => e.isDirectory,
                isFile: () => !e.isDirectory,
              }));
            },
            readFile: async (filePath: string, encoding: string) => {
              const res = await fetch(
                `/api/workspace/files?id=${id}&action=read&path=${encodeURIComponent(filePath)}`
              );
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              return data.content;
            },
            writeFile: async (filePath: string, content: string) => {
              const res = await fetch(`/api/workspace/files?id=${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: filePath, content }),
              });
              if (!res.ok) throw new Error(await res.text());
            },
            mkdir: async (dirPath: string) => {
              const res = await fetch(`/api/workspace/files?id=${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mkdir", path: dirPath }),
              });
              if (!res.ok) throw new Error(await res.text());
            },
            rm: async (nodePath: string, options?: any) => {
              const res = await fetch(
                `/api/workspace/files?id=${id}&path=${encodeURIComponent(nodePath)}`,
                { method: "DELETE" }
              );
              if (!res.ok) throw new Error(await res.text());
            },
          },
          spawn: async (cmd: string, args: string[], options?: any) => {
            const res = await fetch(`/api/workspace/spawn?id=${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cmd, args }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            return {
              exit: Promise.resolve(data.exitCode),
            };
          },
        };

        setInstance(mockInstance);
        const hasVite = templateData?.items?.some(
          (item: any) => item.filename === "vite.config" || (item.filename === "vite" && item.fileExtension === "config.ts")
        );
        setServerUrl(hasVite ? `http://localhost:5173` : `http://localhost:3000`);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Failed to initialize server-side workspace:", err);
        if (mounted) {
          setError(err.message || "Failed to initialize server-side workspace");
          setIsLoading(false);
        }
      }
    }

    initializeWorkspace();

    return () => {
      mounted = false;
    };
  }, [id]);

  const writeFileSync = useCallback(
    async (filePath: string, content: string): Promise<void> => {
      try {
        const res = await fetch(`/api/workspace/files?id=${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath, content }),
        });
        if (!res.ok) throw new Error(await res.text());
      } catch (err: any) {
        console.error(`Failed to write file at ${filePath}:`, err);
        throw new Error(`Failed to write file at ${filePath}: ${err.message}`);
      }
    },
    [id]
  );

  const destory = useCallback(() => {
    // Terminate terminal session
    fetch(`/api/workspace/terminal?id=${id}`, { method: "DELETE" }).catch(() => {});
  }, [id]);

  return {
    serverUrl,
    isLoading,
    error,
    instance,
    writeFileSync,
    destory,
  };
};
