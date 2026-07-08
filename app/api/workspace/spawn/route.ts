import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playground ID" }, { status: 400 });
  }

  try {
    const { cmd, args } = await request.json();
    const workspacePath = path.join(process.cwd(), "workspaces", id);

    const child = spawn(cmd, args || [], {
      cwd: workspacePath,
      shell: true,
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on("close", (code) => {
        resolve(code ?? 0);
      });
      child.on("error", () => {
        resolve(1);
      });
    });

    return NextResponse.json({ exitCode });
  } catch (error: any) {
    console.error("Workspace spawn error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
