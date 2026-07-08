import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, baseUrl, apiKey, model } = body;

    if (!baseUrl || !model) {
      return NextResponse.json(
        { success: false, message: "Base URL and Model Name are required." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    let fetchUrl = baseUrl.trim();
    if (fetchUrl.endsWith("/")) {
      fetchUrl = fetchUrl.slice(0, -1);
    }

    if (provider === "ollama") {
      // Ollama generate endpoint
      const ollamaEndpoint = fetchUrl.endsWith("/api/generate")
        ? fetchUrl
        : `${fetchUrl}/api/generate`;

      try {
        const response = await fetch(ollamaEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model,
            prompt: "ping",
            stream: false,
            options: {
              max_tokens: 5,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(id);

        if (!response.ok) {
          const text = await response.text();
          return NextResponse.json({
            success: false,
            message: `Ollama returned status ${response.status}: ${text || response.statusText}`,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          message: `Successfully connected to Ollama! Model: ${model}`,
        });
      } catch (err: any) {
        clearTimeout(id);
        return NextResponse.json({
          success: false,
          message: `Failed to reach Ollama at ${ollamaEndpoint}. Error: ${err.message}`,
        });
      }
    } else {
      // OpenAI, DeepSeek, or Custom (OpenAI-compatible)
      const openaiEndpoint = fetchUrl.endsWith("/chat/completions")
        ? fetchUrl
        : `${fetchUrl}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === "openai" || provider === "deepseek") {
        // Fall back to server environment variables if key is empty
        const fallbackKey =
          provider === "openai" ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
        if (fallbackKey) {
          headers["Authorization"] = `Bearer ${fallbackKey}`;
        }
      }

      try {
        const response = await fetch(openaiEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
          signal: controller.signal,
        });

        clearTimeout(id);

        if (!response.ok) {
          const text = await response.text();
          let parsedError = "";
          try {
            const errObj = JSON.parse(text);
            parsedError = errObj.error?.message || errObj.message || text;
          } catch {
            parsedError = text || response.statusText;
          }
          return NextResponse.json({
            success: false,
            message: `API returned status ${response.status}: ${parsedError}`,
          });
        }

        return NextResponse.json({
          success: true,
          message: `Successfully connected to ${provider}! Model: ${model}`,
        });
      } catch (err: any) {
        clearTimeout(id);
        return NextResponse.json({
          success: false,
          message: `Failed to reach endpoint ${openaiEndpoint}. Error: ${err.message}`,
        });
      }
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
