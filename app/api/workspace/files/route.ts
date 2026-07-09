import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanTemplateDirectory } from "@/modules/playground/lib/path-to-json";
import fs from "fs/promises";
import path from "path";

// Helper to recursively write template structure to server disk
async function writeTemplateItemToDisk(basePath: string, item: any) {
  if ("folderName" in item) {
    const folderPath = path.join(basePath, item.folderName);
    await fs.mkdir(folderPath, { recursive: true });
    for (const child of item.items) {
      await writeTemplateItemToDisk(folderPath, child);
    }
  } else {
    const filePath = path.join(
      basePath,
      item.filename + (item.fileExtension ? `.${item.fileExtension}` : "")
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, item.content || "", "utf8");
  }
}

async function writeWorkspaceToDisk(workspacePath: string, templateData: any) {
  await fs.mkdir(workspacePath, { recursive: true });
  for (const item of templateData.items) {
    await writeTemplateItemToDisk(workspacePath, item);
  }
}

// Helper to sync server disk workspace structure to MongoDB database
async function syncWorkspaceToDb(playgroundId: string, workspacePath: string) {
  try {
    const templateData = await scanTemplateDirectory(workspacePath);
    const existing = await db.templateFile.findFirst({
      where: { playgroundId },
    });
    if (existing) {
      await db.templateFile.update({
        where: { id: existing.id },
        data: { content: JSON.stringify(templateData) },
      });
    } else {
      await db.templateFile.create({
        data: {
          playgroundId,
          content: JSON.stringify(templateData),
        },
      });
    }
  } catch (error) {
    console.error("Failed to sync workspace to DB:", error);
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const action = request.nextUrl.searchParams.get("action");
  const filePath = request.nextUrl.searchParams.get("path") || "";

  if (!id) {
    return NextResponse.json({ error: "Missing playground ID" }, { status: 400 });
  }

  const workspacePath = path.join(process.cwd(), "workspaces", id);

  try {
    if (action === "init") {
      // Check if folder exists, if not construct it from database
      let folderExists = false;
      try {
        const stats = await fs.stat(workspacePath);
        folderExists = stats.isDirectory();
      } catch (e) {}

      if (!folderExists) {
        // Fetch from MongoDB
        const playground = await db.playground.findUnique({
          where: { id },
          include: { templateFiles: true },
        });

        if (!playground) {
          return NextResponse.json({ error: "Playground not found" }, { status: 404 });
        }

        let templateData: any = { folderName: "Root", items: [] };
        const rawContent = playground.templateFiles?.[0]?.content;
        if (typeof rawContent === "string") {
          templateData = JSON.parse(rawContent);
        } else if (rawContent && typeof rawContent === "object") {
          templateData = rawContent as any;
        } else {
          // If no files saved, load directly from template path on server disk
          const { templatePaths } = await import("@/lib/template");
          const {
            readTemplateStructureFromJson,
            saveTemplateStructureToJson,
          } = await import("@/modules/playground/lib/path-to-json");

          const templateKey = playground.template as keyof typeof templatePaths;
          const templatePath = templatePaths[templateKey];
          if (templatePath) {
            try {
              const inputPath = path.join(process.cwd(), templatePath);
              const outputFile = path.join(process.cwd(), `output/${templateKey}_${id}.json`);
              await fs.mkdir(path.dirname(outputFile), { recursive: true });
              await saveTemplateStructureToJson(inputPath, outputFile);
              templateData = await readTemplateStructureFromJson(outputFile);
              await fs.unlink(outputFile);
            } catch (e) {
              console.error("Local template load error:", e);
            }
          }
        }

        await writeWorkspaceToDisk(workspacePath, templateData);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "read") {
      const fullPath = path.join(workspacePath, filePath);
      const content = await fs.readFile(fullPath, "utf8");
      return NextResponse.json({ content });
    }

    if (action === "readdir") {
      const fullPath = path.join(workspacePath, filePath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const mapped = entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      }));
      return NextResponse.json({ entries: mapped });
    }

    if (action === "sync") {
      // Automatically ensure execute permissions on node_modules/.bin for Linux containers
      if (process.platform !== "win32") {
        const binPath = path.join(workspacePath, "node_modules", ".bin");
        try {
          const { exec } = require("child_process");
          exec(`chmod -R +x "${binPath}"`, () => {});
        } catch (e) {}
      }

      await syncWorkspaceToDb(id, workspacePath);

      const updated = await db.playground.findUnique({
        where: { id },
        include: { templateFiles: true },
      });

      let templateData = { folderName: "Root", items: [] };
      const rawContent = updated?.templateFiles?.[0]?.content;
      if (typeof rawContent === "string") {
        templateData = JSON.parse(rawContent);
      } else if (rawContent && typeof rawContent === "object") {
        templateData = rawContent as any;
      }

      return NextResponse.json({ templateData });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Workspace Files GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playground ID" }, { status: 400 });
  }

  try {
    const { path: filePath, content } = await request.json();
    const workspacePath = path.join(process.cwd(), "workspaces", id);
    const fullPath = path.join(workspacePath, filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content || "", "utf8");

    // Sync updates back to db
    await syncWorkspaceToDb(id, workspacePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Workspace Files POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing playground ID" }, { status: 400 });
  }

  try {
    const { action, path: filePath, newPath, content } = await request.json();
    const workspacePath = path.join(process.cwd(), "workspaces", id);
    const fullPath = path.join(workspacePath, filePath);

    if (action === "rename") {
      const fullNewPath = path.join(workspacePath, newPath);
      await fs.rename(fullPath, fullNewPath);
    } else if (action === "mkdir") {
      await fs.mkdir(fullPath, { recursive: true });
    } else if (action === "createFile") {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content || "", "utf8");
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await syncWorkspaceToDb(id, workspacePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Workspace Files PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const filePath = request.nextUrl.searchParams.get("path") || "";

  if (!id || !filePath) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const workspacePath = path.join(process.cwd(), "workspaces", id);
    const fullPath = path.join(workspacePath, filePath);

    await fs.rm(fullPath, { recursive: true, force: true });

    await syncWorkspaceToDb(id, workspacePath);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Workspace Files DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
