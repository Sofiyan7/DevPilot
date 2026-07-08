"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAISettings } from "@/components/providers/ai-settings-provider";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import {
    Loader2,
    Send,
    User,
    Copy,
    ChevronDown,

    X,

    Code,
    Sparkles,
    MessageSquare,
    RefreshCw,

    Settings,
    Zap,
    Brain,

    Search,
    Filter,
    Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import "katex/dist/katex.min.css";
import Image from "next/image";
import Stream from "stream";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    id: string;
    timestamp: Date;
    type?: "chat" | "code_review" | "suggestion" | "error_fix" | "optimization";
    tokens?: number;
    model?: string;
}

interface AIChatSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    inline?: boolean;
    playgroundId?: string;
}

const MessageTypeIndicator: React.FC<{
    type?: string;
    model?: string;
    tokens?: number;
}> = ({ type, model, tokens }) => {
    const getTypeConfig = (type?: string) => {
        switch (type) {
            case "code_review":
                return { icon: Code, color: "text-blue-400", label: "Code Review" };
            case "suggestion":
                return {
                    icon: Sparkles,
                    color: "text-purple-400",
                    label: "Suggestion",
                };
            case "error_fix":
                return { icon: RefreshCw, color: "text-red-400", label: "Error Fix" };
            case "optimization":
                return { icon: Zap, color: "text-yellow-400", label: "Optimization" };
            default:
                return { icon: MessageSquare, color: "text-zinc-400", label: "Chat" };
        }
    };

    const config = getTypeConfig(type);
    const Icon = config.icon;

    return (
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
                <Icon className={cn("h-3 w-3", config.color)} />
                <span className={cn("text-xs font-medium", config.color)}>
                    {config.label}
                </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
                {model && <span>{model}</span>}
                {tokens && <span>{tokens} tokens</span>}
            </div>
        </div>
    );
};

export const AIChatSidePanel: React.FC<AIChatSidePanelProps> = ({
    isOpen,
    onClose,
    inline = false,
    playgroundId,
}) => {
    const { settings, updateSettings } = useAISettings();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState<
        "chat" | "review" | "fix" | "optimize"
    >("chat");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<string>("all");
    const [autoSave, setAutoSave] = useState(true);
    const [streamResponse, setStreamResponse] = useState(true);
    const [model, setModel] = useState<string>(settings?.model || "gpt-6");

    useEffect(() => {
        if (settings?.model) {
            setModel(settings.model);
        }
    }, [settings?.model]);

    useEffect(() => {
        if (!playgroundId) return;

        const loadHistory = async () => {
            try {
                const res = await fetch(`/api/chat/history?playgroundId=${playgroundId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.messages) {
                        setMessages(data.messages.map((m: any) => ({
                            role: m.role,
                            content: m.content,
                            timestamp: new Date(m.createdAt || m.timestamp || Date.now()),
                            id: m.id || Math.random().toString(),
                            type: m.type || "chat"
                        })));
                    }
                }
            } catch (err) {
                console.error("Failed to load chat history:", err);
            }
        };

        loadHistory();
    }, [playgroundId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            scrollToBottom();
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [messages, isLoading]);

    const getChatModePrompt = (mode: string, content: string) => {
        switch (mode) {
            case "review":
                return `Please review this code and provide detailed suggestions for improvement, including performance, security, and best practices:\n\n**Request:** ${content}`;
            case "fix":
                return `Please help fix issues in this code, including bugs, errors, and potential problems:\n\n**Problem:** ${content}`;
            case "optimize":
                return `Please analyze this code for performance optimizations and suggest improvements:\n\n**Code to optimize:** ${content}`;
            default:
                return content
        }
    };

   const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageType =
      chatMode === "chat"
        ? "chat"
        : chatMode === "review"
        ? "code_review"
        : chatMode === "fix"
        ? "error_fix"
        : "optimization";

    const newMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      id: Date.now().toString(),
      type: messageType,
    };

    const updatedUserMessages = [...messages, newMessage];
    setMessages(updatedUserMessages);
    setInput("");
    setIsLoading(true);

    try {
      const contextualMessage = getChatModePrompt(chatMode, input.trim());

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: contextualMessage,
          history: messages.slice(-10).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: streamResponse,
          mode: chatMode,
          model,
          aiSettings: settings,
          playgroundId,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          id: Date.now().toString(),
          type: messageType,
          tokens: data.tokens,
          model: data.model || "AI Assistant",
        };

        const finalMessages = [...updatedUserMessages, assistantMsg];
        setMessages(finalMessages);

        if (playgroundId) {
          fetch("/api/chat/history", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playgroundId,
              messages: finalMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
            }),
          }).catch((err) => console.error("Error saving chat history:", err));
        }
      } else {
        const assistantErrorMsg: ChatMessage = {
          role: "assistant",
          content: "Sorry, I encountered an error while processing your request. Please try again.",
          timestamp: new Date(),
          id: Date.now().toString(),
        };
        const finalMessages = [...updatedUserMessages, assistantErrorMsg];
        setMessages(finalMessages);

        if (playgroundId) {
          fetch("/api/chat/history", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playgroundId,
              messages: finalMessages.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
            }),
          }).catch((err) => console.error("Error saving chat history:", err));
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please check your internet connection and try again.",
          timestamp: new Date(),
          id: Date.now().toString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

    const exportChat = () => {
         const chatData = {
      messages,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-chat-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    };

    const filteredMessages = messages
        .filter((msg) => {
            if (filterType === "all") return true;
            return msg.type === filterType
        })
        .filter((msg) => {
            if (!searchTerm) return true;
            return msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        })

    return (
        <TooltipProvider>
            <>
                {/* Backdrop */}
                {!inline && (
                    <div
                        className={cn(
                            "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300",
                            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                        onClick={onClose}
                    />
                )}

                {/* Side Panel */}
                <div
                    className={cn(
                        inline
                            ? "h-full w-full bg-zinc-950 flex flex-col"
                            : "fixed right-0 top-0 h-full w-full max-w-6xl bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
                        !inline && (isOpen ? "translate-x-0" : "translate-x-full")
                    )}
                >
                    {/* Enhanced Header */}
                    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-3">
                                <div className="relative w-10 h-10 border border-zinc-800 rounded-full flex flex-col justify-center items-center bg-zinc-900">
                                    <Sparkles className="h-5 w-5 text-red-500 animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-100">
                                        Enhanced AI Assistant
                                    </h2>
                                    <p className="text-sm text-zinc-400">
                                        {messages.length} messages
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="relative mr-1 hidden sm:block">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                                    <Input
                                        placeholder="Search messages..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8 h-8 w-40 bg-zinc-800/40 border-zinc-700/50 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 placeholder-zinc-500 text-zinc-200"
                                    />
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                                            <Filter className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setFilterType("all")}>
                                            All Messages
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setFilterType("chat")}>
                                            Chat Mode Only
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType("code_review")}>
                                            Code Reviews Only
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType("error_fix")}>
                                            Error Fixes Only
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterType("optimization")}>
                                            Optimizations Only
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                                        >
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuCheckboxItem
                                            checked={autoSave}
                                            onCheckedChange={setAutoSave}
                                        >
                                            Auto-save conversations
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={streamResponse}
                                            onCheckedChange={setStreamResponse}
                                        >
                                            Stream responses
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={exportChat}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export Chat
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            setMessages([]);
                                            if (playgroundId) {
                                                fetch(`/api/chat/history?playgroundId=${playgroundId}`, {
                                                    method: "DELETE"
                                                }).catch((err) => console.error("Error clearing chat history:", err));
                                            }
                                        }}>
                                            Clear All Messages
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto bg-zinc-950">
                        <div className="p-6 space-y-6">
                            {filteredMessages.length === 0 && !isLoading && (
                                <div className="text-center text-zinc-500 py-16">
                                    <div className="relative w-16 h-16 border rounded-full flex flex-col justify-center items-center mx-auto mb-4">
                                        <Brain className="h-8 w-8 text-zinc-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-3 text-zinc-300">
                                        Enhanced AI Assistant
                                    </h3>
                                    <p className="text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
                                        Advanced AI coding assistant with comprehensive analysis
                                        capabilities.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                                        {[
                                            "Review my React component for performance",
                                            "Fix TypeScript compilation errors",
                                            "Optimize database query performance",
                                            "Add comprehensive error handling",
                                            "Implement security best practices",
                                            "Refactor code for better maintainability",
                                        ].map((suggestion) => (
                                            <button
                                                key={suggestion}
                                                onClick={() => setInput(suggestion)}
                                                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors text-left"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {filteredMessages.map((msg) => (
                                <div key={msg.id} className="space-y-4">
                                    <div
                                        className={cn(
                                            "flex items-start gap-4 group",
                                            msg.role === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        {msg.role === "assistant" && (
                                            <div className="relative w-10 h-10 border rounded-full flex flex-col justify-center items-center">
                                                <Brain className="h-5 w-5 text-zinc-400" />
                                            </div>
                                        )}

                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-xl shadow-sm",
                                                msg.role === "user"
                                                    ? "bg-zinc-900/70 text-white p-4 rounded-br-md"
                                                    : "bg-zinc-900/80 backdrop-blur-sm text-zinc-100 p-5 rounded-bl-md border border-zinc-800/50"
                                            )}
                                        >
                                            {msg.role === "assistant" && (
                                                <MessageTypeIndicator
                                                    type={msg.type}
                                                    model={msg.model}
                                                    tokens={msg.tokens}
                                                />
                                            )}

                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm, remarkMath]}
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={{
                                                        code: ({ children, className, inline }: any) => {
                                                            if (inline) {
                                                                return (
                                                                    <code className="bg-zinc-800 px-1 py-0.5 rounded text-sm">
                                                                        {children}
                                                                    </code>
                                                                );
                                                            }
                                                            return (
                                                                <div className="bg-zinc-800 rounded-lg p-4 my-4">
                                                                    <pre className="text-sm text-zinc-100 overflow-x-auto">
                                                                        <code className={className}>{children}</code>
                                                                    </pre>
                                                                </div>
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>

                                            {/* Message actions */}
                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-700/30">
                                                <div className="text-xs text-zinc-500">
                                                    {msg.timestamp.toLocaleTimeString()}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            navigator.clipboard.writeText(msg.content)
                                                        }
                                                        className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setInput(msg.content)}
                                                        className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {msg.role === "user" && (
                                            <Avatar className="h-9 w-9 border border-zinc-700 bg-zinc-800 shrink-0">
                                                <AvatarFallback className="bg-zinc-700 text-zinc-300">
                                                    <User className="h-5 w-5" />
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex items-start gap-4 justify-start">
                                    <div className="relative w-10 h-10 border rounded-full flex flex-col justify-center items-center">
                                        <Brain className="h-5 w-5 text-zinc-400" />
                                    </div>
                                    <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 p-5 rounded-xl rounded-bl-md flex items-center gap-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                        <span className="text-sm text-zinc-300">
                                            {chatMode === "review"
                                                ? "Analyzing code structure and patterns..."
                                                : chatMode === "fix"
                                                    ? "Identifying issues and solutions..."
                                                    : chatMode === "optimize"
                                                        ? "Analyzing performance bottlenecks..."
                                                        : "Processing your request..."}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} className="h-1" />
                        </div>
                    </div>

                    {/* Unified Bottom Chat Container */}
                    <div className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                        <form onSubmit={handleSendMessage}>
                            <div className="border border-zinc-850 rounded-xl bg-zinc-950/80 p-2 focus-within:border-zinc-700 transition-all flex flex-col gap-2">
                                <Textarea
                                    placeholder={
                                        chatMode === "chat"
                                            ? "Ask about your code, request improvements, or paste code to analyze..."
                                            : chatMode === "review"
                                                ? "Describe what you'd like me to review in your code..."
                                                : chatMode === "fix"
                                                    ? "Describe the issue you're experiencing..."
                                                    : "Describe what you'd like me to optimize..."
                                    }
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage(e as any);
                                        }
                                    }}
                                    disabled={isLoading}
                                    className="min-h-[50px] max-h-32 bg-transparent border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-100 placeholder-zinc-500 focus:border-0 focus:ring-offset-0 focus:ring-0 resize-none w-full p-2 text-sm"
                                    rows={2}
                                />
                                
                                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 px-1 gap-2 w-full min-w-0">
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                        {/* Model Selector Pill */}
                                        <div className="relative flex-1 min-w-[100px] max-w-[180px]">
                                            <select
                                                value={model}
                                                onChange={(e) => {
                                                    const selectedValue = e.target.value;
                                                    setModel(selectedValue);
                                                    updateSettings({ model: selectedValue });
                                                }}
                                                className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg pl-2 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer appearance-none relative text-ellipsis overflow-hidden whitespace-nowrap"
                                            >
                                                {Array.from(new Set([settings.model || "codellama:latest"]))
                                                    .filter(Boolean)
                                                    .map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                            <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                                        </div>

                                        {/* Mode Selector Pill */}
                                        <div className="relative flex-1 min-w-[80px] max-w-[120px]">
                                            <select
                                                value={chatMode}
                                                onChange={(e) => setChatMode(e.target.value as any)}
                                                className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg pl-2 pr-7 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer appearance-none relative text-ellipsis overflow-hidden whitespace-nowrap"
                                            >
                                                <option value="chat">💬 Chat</option>
                                                <option value="review">🔍 Review</option>
                                                <option value="fix">🛠️ Fix</option>
                                                <option value="optimize">⚡ Optimize</option>
                                            </select>
                                            <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <kbd className="hidden md:inline-block text-[10px] text-zinc-500 whitespace-nowrap">
                                            Enter to send
                                        </kbd>
                                        <Button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium border-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Send className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </>
        </TooltipProvider>
    );
};