import { NextRequest } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";

// Define a type for our active sessions
interface TerminalSession {
  process: ChildProcess;
  outputBuffer: string;
  listeners: Set<(data: Buffer) => void>;
}

// Persistent map on globalThis to survive Hot Module Replacement (HMR) in development
const globalForTerminal = globalThis as unknown as {
  terminalSessions?: Map<string, TerminalSession>;
};

if (!globalForTerminal.terminalSessions) {
  globalForTerminal.terminalSessions = new Map<string, TerminalSession>();
}

const sessions = globalForTerminal.terminalSessions;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("Missing playground ID", { status: 400 });
  }

  const workspacePath = path.join(process.cwd(), "workspaces", id);
  await fs.mkdir(workspacePath, { recursive: true });

  let session = sessions.get(id);

  if (!session) {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "powershell.exe" : "bash";
    const args = isWindows ? ["-NoLogo"] : ["-i"];

    const child = spawn(shell, args, {
      cwd: workspacePath,
      env: {
        ...process.env,
        FORCE_COLOR: "1", // Hint tools to use color codes
        TERM: "xterm-color",
      },
      shell: false,
    });

    session = {
      process: child,
      outputBuffer: "",
      listeners: new Set(),
    };

    // Buffer output and dispatch to active listeners
    const handleData = (data: Buffer) => {
      if (session) {
        session.outputBuffer += data.toString("utf8");
        // Limit buffer size to last 50KB to prevent memory leaks
        if (session.outputBuffer.length > 50000) {
          session.outputBuffer = session.outputBuffer.slice(-50000);
        }
        for (const listener of session.listeners) {
          listener(data);
        }
      }
    };

    child.stdout?.on("data", handleData);
    child.stderr?.on("data", handleData);

    child.on("close", () => {
      sessions.delete(id);
    });

    sessions.set(id, session);
  }

  // Create stream for this request connection
  const encoder = new TextEncoder();
  let onDataListener: ((data: Buffer) => void) | null = null;

  const responseStream = new ReadableStream({
    start(controller) {
      // 1. Write the existing terminal buffer history so user sees state on page reload
      if (session?.outputBuffer) {
        controller.enqueue(encoder.encode(session.outputBuffer));
      }

      // 2. Register data listener for new output
      onDataListener = (data: Buffer) => {
        try {
          controller.enqueue(encoder.encode(data.toString("utf8")));
        } catch (e) {
          // Connection likely closed
        }
      };
      session?.listeners.add(onDataListener);
    },
    cancel() {
      if (session && onDataListener) {
        session.listeners.delete(onDataListener);
        // If there are zero listeners connected, we keep the process alive
        // so background servers or commands continue running, but they can be killed if idle
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("Missing playground ID", { status: 400 });
  }

  try {
    const { input } = await request.json();
    const session = sessions.get(id);

    if (session && session.process.stdin && !session.process.killed) {
      session.process.stdin.write(input);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No active session found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("Missing playground ID", { status: 400 });
  }

  const session = sessions.get(id);
  if (session) {
    const pid = session.process.pid;
    if (pid && process.platform === "win32") {
      const { exec } = require("child_process");
      exec(`taskkill /pid ${pid} /f /t`, (err: any) => {
        if (err) console.error("taskkill error:", err);
      });
    } else {
      session.process.kill("SIGKILL");
    }
    sessions.delete(id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "No active session to terminate" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
