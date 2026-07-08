import { db } from "@/lib/db";
import { error } from "console";
import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  aiSettings?: {
    provider: "ollama" | "openai" | "deepseek" | "custom";
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  playgroundId?: string;
}

async function generateAIResponse(
  messages: ChatMessage[],
  aiSettings?: ChatRequest["aiSettings"],
  playgroundId?: string
): Promise<string> {
  const provider = aiSettings?.provider || "ollama";
  let baseUrl = aiSettings?.baseUrl?.trim() || "http://localhost:11434";
  const apiKey = aiSettings?.apiKey || "";
  const model = aiSettings?.model || "codellama:latest";

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  let systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

  if (playgroundId) {
    try {
      const globalForTerminal = globalThis as unknown as {
        terminalSessions?: Map<string, any>;
      };
      const session = globalForTerminal.terminalSessions?.get(playgroundId);
      if (session?.outputBuffer) {
        // Strip ANSI escape sequences
        const cleanLogs = session.outputBuffer
          .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "")
          .slice(-4000); // Limit to last 4KB
        systemPrompt += `\n\n[CONTEXT: ACTIVE PROJECT TERMINAL LOGS]\n\`\`\`\n${cleanLogs}\n\`\`\`\nUse these terminal logs to diagnose and explain any active build, runtime, or command execution errors if the user is asking about an issue or asking why a command/app failed.`;
      }
    } catch (e) {
      console.error("Failed to append terminal logs to context:", e);
    }
  }

  try {
    let response;

    if (provider === "ollama") {
      const fetchUrl = baseUrl.endsWith("/api/generate") ? baseUrl : `${baseUrl}/api/generate`;
      
      const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];
      const prompt = fullMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n\n");

      response = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama service error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.response) {
        throw new Error("No response from Ollama model");
      }
      return data.response.trim();
    } else {
      const fetchUrl = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        const fallbackKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
        if (fallbackKey) {
          headers["Authorization"] = `Bearer ${fallbackKey}`;
        }
      }

      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      response = await fetch(fetchUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI service error (${response.status}): ${text}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error("No response from AI model");
      }
      return assistantMessage.trim();
    }
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error("Failed to generate AI response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], aiSettings, playgroundId } = body;
    
    // Validate input
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate history format
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
      : [];

    const recentHistory = validHistory.slice(-10);

    const messages: ChatMessage[] = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    //   Generate ai response

    const aiResponse = await generateAIResponse(messages, aiSettings, playgroundId);



    return NextResponse.json({
      response: aiResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
