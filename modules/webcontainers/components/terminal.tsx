"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { SearchAddon } from "xterm-addon-search";
import "xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileExplorer } from "../../playground/hooks/useFileExplorer";

interface TerminalProps {
  webcontainerUrl?: string;
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: any;
  isGuideVisible?: boolean;
  onToggleGuide?: () => void;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
}

const 
TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({ 
  webcontainerUrl, 
  className,
  theme = "dark",
  webContainerInstance,
  isGuideVisible,
  onToggleGuide
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Command line state
  const currentLine = useRef<string>("");
  const cursorPosition = useRef<number>(0);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const currentProcess = useRef<any>(null);
  const shellProcess = useRef<any>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    instanceRef.current = webContainerInstance;
  }, [webContainerInstance]);

  const terminalThemes = {
    dark: {
      background: "#09090B",
      foreground: "#FAFAFA",
      cursor: "#FAFAFA",
      cursorAccent: "#09090B",
      selection: "#27272A",
      black: "#18181B",
      red: "#EF4444",
      green: "#22C55E",
      yellow: "#EAB308",
      blue: "#3B82F6",
      magenta: "#A855F7",
      cyan: "#06B6D4",
      white: "#F4F4F5",
      brightBlack: "#3F3F46",
      brightRed: "#F87171",
      brightGreen: "#4ADE80",
      brightYellow: "#FDE047",
      brightBlue: "#60A5FA",
      brightMagenta: "#C084FC",
      brightCyan: "#22D3EE",
      brightWhite: "#FFFFFF",
    },
    light: {
      background: "#FFFFFF",
      foreground: "#18181B",
      cursor: "#18181B",
      cursorAccent: "#FFFFFF",
      selection: "#E4E4E7",
      black: "#18181B",
      red: "#DC2626",
      green: "#16A34A",
      yellow: "#CA8A04",
      blue: "#2563EB",
      magenta: "#9333EA",
      cyan: "#0891B2",
      white: "#F4F4F5",
      brightBlack: "#71717A",
      brightRed: "#EF4444",
      brightGreen: "#22C55E",
      brightYellow: "#EAB308",
      brightBlue: "#3B82F6",
      brightMagenta: "#A855F7",
      brightCyan: "#06B6D4",
      brightWhite: "#FAFAFA",
    },
  };

  const writePrompt = useCallback(() => {
    if (term.current) {
      term.current.write("\r\n$ ");
      currentLine.current = "";
      cursorPosition.current = 0;
    }
  }, []);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    writeToTerminal: (data: string) => {
      if (term.current) {
        term.current.write(data);
      }
    },
    clearTerminal: () => {
      clearTerminal();
    },
    focusTerminal: () => {
      if (term.current) {
        term.current.focus();
      }
    },
  }));

  const executeCommand = useCallback(async (command: string) => {
    if (!webContainerInstance || !term.current) return;

    // Add to history
    if (command.trim() && commandHistory.current[commandHistory.current.length - 1] !== command) {
      commandHistory.current.push(command);
    }
    historyIndex.current = -1;

    try {
      if (webContainerInstance.isServer) {
        term.current.writeln(""); // advance line locally
        await fetch(`/api/workspace/terminal?id=${webContainerInstance.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: command + "\n" }),
        });
        currentLine.current = "";
        cursorPosition.current = 0;

        // Trigger immediate file sync from disk to DB & update the explorer store
        fetch(`/api/workspace/files?id=${webContainerInstance.id}&action=sync`)
          .then((res) => {
            if (res.ok) return res.json();
          })
          .then((data) => {
            if (data?.templateData) {
              useFileExplorer.getState().setTemplateData(data.templateData);
            }
          })
          .catch(() => {});

        return;
      }

      // Handle built-in commands
      if (command.trim() === "clear") {
        term.current.clear();
        writePrompt();
        return;
      }

      if (command.trim() === "history") {
        commandHistory.current.forEach((cmd, index) => {
          term.current!.writeln(`  ${index + 1}  ${cmd}`);
        });
        writePrompt();
        return;
      }

      if (command.trim() === "") {
        writePrompt();
        return;
      }

      // Parse command
      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Execute in WebContainer
      term.current.writeln("");
      const process = await webContainerInstance.spawn(cmd, args, {
        terminal: {
          cols: term.current.cols,
          rows: term.current.rows,
        },
      });

      currentProcess.current = process;

      // Handle process output
      process.output.pipeTo(new WritableStream({
        write(data) {
          if (term.current) {
            term.current.write(data);
          }
        },
      }));

      // Wait for process to complete
      const exitCode = await process.exit;
      currentProcess.current = null;

      // Show new prompt
      writePrompt();

    } catch (error) {
      if (term.current) {
        term.current.writeln(`\r\nCommand not found: ${command}`);
        writePrompt();
      }
      currentProcess.current = null;
    }
  }, [webContainerInstance, writePrompt]);

  const handleTerminalInput = useCallback((data: string) => {
    if (!term.current) return;

    // Handle special characters
    switch (data) {
      case '\r': // Enter
        executeCommand(currentLine.current);
        break;
        
      case '\u007F': // Backspace
        if (cursorPosition.current > 0) {
          currentLine.current = 
            currentLine.current.slice(0, cursorPosition.current - 1) + 
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current--;
          
          // Update terminal display
          term.current.write('\b \b');
        }
        break;
        
      case '\u0003': // Ctrl+C
        if (term.current.hasSelection()) {
          const selectedText = term.current.getSelection();
          navigator.clipboard.writeText(selectedText).catch(() => {});
          return;
        }
        if (instanceRef.current?.isServer) {
          fetch(`/api/workspace/terminal?id=${instanceRef.current.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: "\u0003" }),
          }).catch(() => {});
        } else if (currentProcess.current) {
          currentProcess.current.kill();
          currentProcess.current = null;
        }
        term.current.writeln("^C");
        if (!instanceRef.current?.isServer) {
          writePrompt();
        }
        break;

      case '\u0016': // Ctrl+V
        navigator.clipboard.readText().then((text) => {
          if (text && term.current) {
            currentLine.current = 
              currentLine.current.slice(0, cursorPosition.current) + 
              text + 
              currentLine.current.slice(cursorPosition.current);
            cursorPosition.current += text.length;
            term.current.write(text);
          }
        }).catch((err) => {
          console.error("Failed to read clipboard:", err);
        });
        break;
        
      case '\u001b[A': // Up arrow
        if (commandHistory.current.length > 0) {
          if (historyIndex.current === -1) {
            historyIndex.current = commandHistory.current.length - 1;
          } else if (historyIndex.current > 0) {
            historyIndex.current--;
          }
          
          // Clear current line and write history command
          const historyCommand = commandHistory.current[historyIndex.current];
          term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
          term.current.write(historyCommand);
          currentLine.current = historyCommand;
          cursorPosition.current = historyCommand.length;
        }
        break;
        
      case '\u001b[B': // Down arrow
        if (historyIndex.current !== -1) {
          if (historyIndex.current < commandHistory.current.length - 1) {
            historyIndex.current++;
            const historyCommand = commandHistory.current[historyIndex.current];
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            term.current.write(historyCommand);
            currentLine.current = historyCommand;
            cursorPosition.current = historyCommand.length;
          } else {
            historyIndex.current = -1;
            term.current.write('\r$ ' + ' '.repeat(currentLine.current.length) + '\r$ ');
            currentLine.current = "";
            cursorPosition.current = 0;
          }
        }
        break;
        
      default:
        // Regular character input
        if (data >= ' ' || data === '\t') {
          currentLine.current = 
            currentLine.current.slice(0, cursorPosition.current) + 
            data + 
            currentLine.current.slice(cursorPosition.current);
          cursorPosition.current++;
          term.current.write(data);
        }
        break;
    }
  }, [executeCommand, writePrompt]);

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current || term.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: terminalThemes[theme],
      allowTransparency: false,
      convertEol: true,
      scrollback: 1000,
      tabStopWidth: 4,
    });

    // Add addons
    const fitAddonInstance = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddonInstance = new SearchAddon();

    terminal.loadAddon(fitAddonInstance);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddonInstance);

    terminal.open(terminalRef.current);
    
    fitAddon.current = fitAddonInstance;
    searchAddon.current = searchAddonInstance;
    term.current = terminal;

    // Handle terminal input
    terminal.onData(handleTerminalInput);

    // Initial fit
    setTimeout(() => {
      try {
        fitAddonInstance.fit();
      } catch (e) {}
    }, 100);

    // Welcome message
    terminal.writeln("🚀 WebContainer Terminal");
    terminal.writeln("Type 'help' for available commands");
    writePrompt();

    return terminal;
  }, [theme, handleTerminalInput, writePrompt]);

  const connectToServerWorkspace = useCallback(async () => {
    if (!webContainerInstance || !term.current) return;
    const playgroundId = webContainerInstance.id;

    let retries = 3;
    let delay = 1000;

    const attemptConnect = async () => {
      try {
        setIsConnected(true);
        if (term.current) {
          term.current.writeln("🔌 Connecting to server workspace terminal...");
        }

        const response = await fetch(`/api/workspace/terminal?id=${playgroundId}`);
        if (!response.ok) {
          throw new Error(await response.text());
        }

        if (!term.current) return;
        term.current.clear();
        term.current.writeln("🚀 DevPilot Server Terminal");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            if (term.current) {
              term.current.write(text);
            }
          }
        }
      } catch (error) {
        console.error("Server terminal connection error:", error);
        if (retries > 0) {
          retries--;
          if (term.current) {
            term.current.writeln(`⚠️ Connection failed. Retrying in ${delay / 1000}s... (${retries} attempts left)`);
          }
          setTimeout(attemptConnect, delay);
          delay *= 1.5;
        } else {
          setIsConnected(false);
          if (term.current) {
            term.current.writeln("❌ Failed to connect to server workspace terminal");
          }
        }
      }
    };

    attemptConnect();
  }, [webContainerInstance]);

  const connectToWebContainer = useCallback(async () => {
    if (!webContainerInstance || !term.current) return;

    try {
      setIsConnected(true);
      term.current.writeln("✅ Connected to WebContainer");
      term.current.writeln("Ready to execute commands");
      writePrompt();
    } catch (error) {
      setIsConnected(false);
      term.current.writeln("❌ Failed to connect to WebContainer");
      console.error("WebContainer connection error:", error);
    }
  }, [webContainerInstance, writePrompt]);

  const clearTerminal = useCallback(async () => {
    if (term.current) {
      if (webContainerInstance?.isServer) {
        term.current.clear();
        term.current.writeln("🔌 Resetting server workspace terminal...");
        try {
          // Notify the parent IDE preview button to clear instantly
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("terminal-reset"));
          }
          // Terminate active session process tree
          await fetch(`/api/workspace/terminal?id=${webContainerInstance.id}`, {
            method: "DELETE",
          });
          // Re-connect to clean session
          connectToServerWorkspace();
        } catch (e) {
          term.current.writeln("❌ Failed to reset terminal session");
        }
        return;
      }

      term.current.clear();
      term.current.writeln("🚀 WebContainer Terminal");
      writePrompt();
    }
  }, [webContainerInstance, writePrompt, connectToServerWorkspace]);

  const copyTerminalContent = useCallback(async () => {
    if (term.current) {
      const content = term.current.getSelection();
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
        } catch (error) {
          console.error("Failed to copy to clipboard:", error);
        }
      }
    }
  }, []);

  const downloadTerminalLog = useCallback(() => {
    if (term.current) {
      const buffer = term.current.buffer.active;
      let content = "";
      
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + "\n";
        }
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const searchInTerminal = useCallback((term: string) => {
    if (searchAddon.current && term) {
      searchAddon.current.findNext(term);
    }
  }, []);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (
        event.message &&
        (event.message.includes("dimensions") || 
         event.message.includes("reading 'dimensions'") ||
         event.message.includes("Cannot read properties of null (reading 'clear')"))
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message &&
        (event.reason.message.includes("dimensions") || 
         event.reason.message.includes("reading 'dimensions'"))
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    initializeTerminal();
    let resizeTimeoutId: any = null;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && term.current) {
        if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
        resizeTimeoutId = setTimeout(() => {
          try {
            if (term.current && fitAddon.current) {
              fitAddon.current.fit();
            }
          } catch (e) {
            // Ignore dimensions errors on hidden container
          }
        }, 100);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      resizeObserver.disconnect();
      if (currentProcess.current) {
        currentProcess.current.kill();
      }
      if (shellProcess.current) {
        shellProcess.current.kill();
      }
      if (term.current) {
        try {
          term.current.dispose();
        } catch (e) {}
        term.current = null;
      }
    };
  }, [initializeTerminal]);

  useEffect(() => {
    if (webContainerInstance && term.current && !isConnected) {
      if (webContainerInstance.isServer) {
        connectToServerWorkspace();
      } else {
        connectToWebContainer();
      }
    }
  }, [webContainerInstance, connectToWebContainer, connectToServerWorkspace, isConnected]);

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium">WebContainer Terminal</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value);
                }}
                className="h-6 w-32 text-xs"
              />
            </div>
          )}
          
          {onToggleGuide && (
            <Button
              variant={isGuideVisible ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleGuide}
              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground mr-1"
            >
              <HelpCircle className="h-3 w-3" />
              <span>Guide</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={copyTerminalContent}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTerminalLog}
            className="h-6 w-6 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative">
        <div 
          ref={terminalRef} 
          className="absolute inset-0 p-2"
          style={{ 
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;