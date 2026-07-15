import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { scanTemplateDirectory } from "@/modules/playground/lib/path-to-json";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

// Helper to run git clone
function runGitClone(repoUrl: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clone with depth 1 to make it fast
    const git = spawn("git", ["clone", "--depth", "1", repoUrl, targetPath]);
    
    let stderr = "";
    git.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    git.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Git clone exited with code ${code}`));
      }
    });
  });
}

// Helper to detect template type from package.json dependencies
async function detectTemplate(workspacePath: string): Promise<"REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR" | "BLANK"> {
  try {
    const pkgPath = path.join(workspacePath, "package.json");
    const pkgData = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    const deps = { ...(pkgData.dependencies || {}), ...(pkgData.devDependencies || {}) };

    if (deps["next"]) return "NEXTJS";
    if (deps["react"]) return "REACT";
    if (deps["vue"]) return "VUE";
    if (deps["express"]) return "EXPRESS";
    if (deps["hono"]) return "HONO";
    if (deps["@angular/core"]) return "ANGULAR";
    
    return "BLANK";
  } catch (e) {
    return "BLANK";
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { repoUrl, customizeTitle } = await request.json();
    if (!repoUrl) {
      return NextResponse.json({ error: "Missing repository URL" }, { status: 400 });
    }

    // 1. Clean the GitHub URL and insert token if private
    let targetUrl = repoUrl.trim();
    if (targetUrl.endsWith(".git")) {
      targetUrl = targetUrl.slice(0, -4);
    }

    // Get GitHub Token if user has connected account
    const githubAccount = await db.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "github",
      },
    });

    const token = githubAccount?.accessToken;
    if (token && targetUrl.includes("github.com")) {
      // Inject token for cloning private/public repositories
      const match = targetUrl.match(/github\.com[\/:][^\/]+\/[^\/]+/);
      if (match) {
        const repoPath = match[0].replace("github.com/", "").replace("github.com:", "");
        targetUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`;
      }
    }

    // Parse repository name for project title
    const repoNameMatch = repoUrl.match(/\/([^\/]+)\/?$/);
    const repoName = repoNameMatch ? repoNameMatch[1].replace(".git", "") : "Cloned Repo";
    const projectTitle = customizeTitle || repoName;

    // 2. Setup workspaces target directory
    // We create a unique temporary ID to isolate the cloned repo
    const playgroundId = "cloned-" + Math.random().toString(36).substring(2, 15);
    const workspacePath = path.join(process.cwd(), "workspaces", playgroundId);

    // Run git clone
    await runGitClone(targetUrl, workspacePath);

    // Remove the .git folder to prevent nested git tracking conflicts
    try {
      await fs.rm(path.join(workspacePath, ".git"), { recursive: true, force: true });
    } catch (e) {}

    // 3. Detect Template Type & Scan Workspace Directory
    const templateType = await detectTemplate(workspacePath);
    const templateData = await scanTemplateDirectory(workspacePath);

    // 4. Create playground entry in MongoDB database
    const playground = await db.playground.create({
      data: {
        id: playgroundId,
        title: projectTitle,
        description: `Cloned from repository: ${repoUrl}`,
        template: templateType,
        userId: session.user.id,
        templateFiles: {
          create: [
            {
              content: JSON.stringify(templateData),
            },
          ],
        },
      },
    });

    return NextResponse.json({ success: true, playgroundId: playground.id });
  } catch (error: any) {
    console.error("Cloning repository error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clone repository. Ensure the URL is valid and accessible." },
      { status: 500 }
    );
  }
}
