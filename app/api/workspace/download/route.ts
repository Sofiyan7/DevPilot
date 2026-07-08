import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
// @ts-ignore
import AdmZip from "adm-zip";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response("Missing playground ID", { status: 400 });
  }

  try {
    const playground = await db.playground.findUnique({
      where: { id },
    });

    if (!playground) {
      return new Response("Playground not found", { status: 404 });
    }

    const workspacePath = path.join(process.cwd(), "workspaces", id);

    // Check if workspace directory exists on disk, initialize if missing
    const folderExists = await fs.access(workspacePath)
      .then(() => true)
      .catch(() => false);

    if (!folderExists) {
      // Trigger local initialization to fetch/write files
      const fullPlayground = await db.playground.findUnique({
        where: { id },
        include: { templateFiles: true },
      });

      let templateData: any = { folderName: "Root", items: [] };
      const rawContent = fullPlayground?.templateFiles?.[0]?.content;
      if (typeof rawContent === "string") {
        templateData = JSON.parse(rawContent);
      } else if (rawContent && typeof rawContent === "object") {
        templateData = rawContent as any;
      } else {
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
            console.error("Local template load error during download init:", e);
          }
        }
      }

      const writeItem = async (base: string, item: any) => {
        if ("folderName" in item) {
          const folderPath = path.join(base, item.folderName);
          await fs.mkdir(folderPath, { recursive: true });
          for (const child of item.items) {
            await writeItem(folderPath, child);
          }
        } else {
          const filePath = path.join(
            base,
            item.filename + (item.fileExtension ? `.${item.fileExtension}` : "")
          );
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, item.content || "");
        }
      };

      await fs.mkdir(workspacePath, { recursive: true });
      for (const item of templateData.items) {
        await writeItem(workspacePath, item);
      }
    }

    // Recursively package the workspace excluding node_modules, .git, .next, etc.
    const zip = new AdmZip();

    const addFilesToZip = async (currentPath: string, zipPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        // Skip build caches, node_modules, and git folders to make the download fast
        if (
          name === "node_modules" ||
          name === ".git" ||
          name === ".next" ||
          name === "dist" ||
          name === ".next-dev"
        ) {
          continue;
        }

        const fullPath = path.join(currentPath, name);
        const relativeZipPath = zipPath ? `${zipPath}/${name}` : name;

        if (entry.isDirectory()) {
          await addFilesToZip(fullPath, relativeZipPath);
        } else {
          const fileBuffer = await fs.readFile(fullPath);
          zip.addFile(relativeZipPath, fileBuffer);
        }
      }
    };

    await addFilesToZip(workspacePath, "");

    const zipBuffer = zip.toBuffer();

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${playground.title.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate ZIP download:", error);
    return new Response("Failed to generate ZIP download", { status: 500 });
  }
}
