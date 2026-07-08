"use client";

import React, { useState, useEffect } from "react";
import { useAISettings, AISettings } from "@/components/providers/ai-settings-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export function AISettingsDialog() {
  const { settings, updateSettings, isOpen, setIsOpen, resetToDefault } = useAISettings();

  const [provider, setProvider] = useState<AISettings["provider"]>(settings.provider);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setProvider(settings.provider);
      setBaseUrl(settings.baseUrl);
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setTestResult(null);
    }
  }, [isOpen, settings]);

  // Autofill defaults when provider changes
  const handleProviderChange = (value: AISettings["provider"]) => {
    setProvider(value);
    setTestResult(null);
    if (value === "ollama") {
      setBaseUrl("http://localhost:11434");
      setModel("codellama:latest");
      setApiKey("");
    } else if (value === "openai") {
      setBaseUrl("https://api.openai.com/v1");
      setModel("gpt-4o-mini");
    } else if (value === "deepseek") {
      setBaseUrl("https://api.deepseek.com/v1");
      setModel("deepseek-coder");
    } else {
      setBaseUrl("");
      setModel("");
      setApiKey("");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/test-ai-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, baseUrl, apiKey, model }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({ success: true, message: data.message || "Connection successful!" });
        toast.success("AI connection verified successfully!");
      } else {
        setTestResult({ success: false, message: data.message || "Connection failed." });
        toast.error(data.message || "Failed to verify AI connection.");
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      setTestResult({ success: false, message: error.message || "Network error. Make sure the server is reachable." });
      toast.error("Network error during verification.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ provider, baseUrl, apiKey, model });
    toast.success("AI settings updated successfully!");
    setIsOpen(false);
  };

  const handleReset = () => {
    resetToDefault();
    setProvider("ollama");
    setBaseUrl("http://localhost:11434");
    setApiKey("");
    setModel("codellama:latest");
    setTestResult(null);
    toast.info("Settings reset to Ollama defaults.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>AI Assistant Settings</DialogTitle>
          <DialogDescription>
            Configure your AI integration. Choose between a local Ollama instance or cloud provider endpoints.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Provider Select */}
          <div className="space-y-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="custom">Custom (OpenAI Compatible)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="ai-baseurl">Base URL</Label>
            <Input
              id="ai-baseurl"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder={provider === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1"}
              required
            />
          </div>

          {/* API Key */}
          {provider !== "ollama" && (
            <div className="space-y-2">
              <Label htmlFor="ai-apikey">API Key</Label>
              <Input
                id="ai-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder={provider === "custom" ? "Optional key" : "sk-..."}
                required={provider !== "custom"}
              />
            </div>
          )}

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="ai-model">Model Name</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setTestResult(null);
              }}
              placeholder="e.g. codellama:latest, gpt-4o-mini"
              required
            />
          </div>

          {/* Connection Test Results */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-sm flex items-start gap-2.5 ${
                testResult.success
                  ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-300"
                  : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <div>
                <p className="font-medium">{testResult.success ? "Success" : "Failed"}</p>
                <p className="text-xs opacity-90 leading-relaxed mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="text-xs text-muted-foreground self-start hover:text-foreground"
            >
              Reset to default
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || !baseUrl || !model}
                className="gap-2"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
