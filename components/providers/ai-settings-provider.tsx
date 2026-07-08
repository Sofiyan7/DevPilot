"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface AISettings {
  provider: "ollama" | "openai" | "deepseek" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface AISettingsContextType {
  settings: AISettings;
  updateSettings: (newSettings: Partial<AISettings>) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  resetToDefault: () => void;
}

export const DEFAULT_SETTINGS: AISettings = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  apiKey: "",
  model: "codellama:latest",
};

const AISettingsContext = createContext<AISettingsContextType | undefined>(undefined);

export const AISettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("vibecode_ai_settings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load AI settings:", e);
    }
    setIsLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem("vibecode_ai_settings", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save AI settings:", e);
      }
      return updated;
    });
  };

  const resetToDefault = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem("vibecode_ai_settings", JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.error("Failed to reset AI settings:", e);
    }
  };

  return (
    <AISettingsContext.Provider value={{ settings, updateSettings, isOpen, setIsOpen, resetToDefault }}>
      {children}
    </AISettingsContext.Provider>
  );
};

export const useAISettings = () => {
  const context = useContext(AISettingsContext);
  if (!context) {
    throw new Error("useAISettings must be used within an AISettingsProvider");
  }
  return context;
};
