import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import net from "net";

// Access the shared global terminal sessions Map
const globalForTerminal = globalThis as unknown as {
  terminalSessions?: Map<string, any>;
};

// Check if a local port is actively listening for TCP connections
function checkPortActive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(250);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

// List of common development ports to scan for auto-forwarding
const PORTS_TO_SCAN = [5173, 3000, 8080, 5000, 4200, 8000, 3001];

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playground ID" }, { status: 400 });
  }

  const sessions = globalForTerminal.terminalSessions;
  if (!sessions) {
    return NextResponse.json({ url: null });
  }

  const session = sessions.get(id);
  if (!session) {
    return NextResponse.json({ url: null });
  }

  // 1. Scan for active local ports
  let activePort: number | null = null;
  for (const port of PORTS_TO_SCAN) {
    // Exclude the main server port running DevPilot itself
    if (port === 7860) continue;

    const isActive = await checkPortActive(port);
    if (isActive) {
      activePort = port;
      break; // Forward the first active server port found
    }
  }

  // 2. If no active port found, kill any existing tunnel and return null
  if (!activePort) {
    if (session.tunnelProcess) {
      try {
        session.tunnelProcess.kill();
      } catch (e) {}
      session.tunnelProcess = undefined;
      session.tunnelUrl = undefined;
      session.tunnelPort = undefined;
    }
    return NextResponse.json({ url: null });
  }

  // 3. If a tunnel is already booting or running for the detected active port, reuse it
  if (session.tunnelPort === activePort) {
    if (session.tunnelUrl) {
      return NextResponse.json({ url: session.tunnelUrl });
    }
    // Wait for the existing tunnel process to resolve the URL
    let attempts = 0;
    while (!session.tunnelUrl && attempts < 10 && session.tunnelPort === activePort) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }
    return NextResponse.json({ url: session.tunnelUrl || null });
  }

  // 4. If the port changed, kill the old tunnel process
  if (session.tunnelProcess) {
    try {
      session.tunnelProcess.kill();
    } catch (e) {}
    session.tunnelProcess = undefined;
    session.tunnelUrl = undefined;
    session.tunnelPort = undefined;
  }

  try {
    // Spawn localtunnel in the background pointing to the newly active port
    const child = spawn("npx", ["-y", "localtunnel", "--port", String(activePort)], {
      shell: true,
      env: { ...process.env },
    });

    session.tunnelProcess = child;
    session.tunnelPort = activePort;

    // Listen to stdout to parse the generated public tunnel URL
    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      const match = text.match(/https?:\/\/[^\s]+/);
      if (match) {
        session.tunnelUrl = match[0].trim();
      }
    });

    // Listen to stderr for debug logs
    child.stderr.on("data", (data: Buffer) => {
      console.error("Tunnel stderr:", data.toString("utf8"));
    });

    child.on("close", () => {
      if (session.tunnelPort === activePort) {
        session.tunnelProcess = undefined;
        session.tunnelUrl = undefined;
        session.tunnelPort = undefined;
      }
    });

    // Wait up to 6 seconds for the public URL to be printed by localtunnel
    let attempts = 0;
    while (!session.tunnelUrl && attempts < 12) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    if (session.tunnelUrl) {
      return NextResponse.json({ url: session.tunnelUrl });
    } else {
      return NextResponse.json({ url: null, warning: "Tunnel startup timeout" });
    }
  } catch (error) {
    console.error("Failed to start auto-tunnel:", error);
    return NextResponse.json({ url: null });
  }
}
