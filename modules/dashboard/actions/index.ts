"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

export const toggleStarMarked = async (
  playgroundId: string,
  isChecked: boolean
) => {
  const user = await currentUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("User Id is Required");
  }

  try {
    if (isChecked) {
      await db.starMark.create({
        data: {
          userId: userId!,
          playgroundId,
          isMarked: isChecked,
        },
      });
    } else {
        await db.starMark.delete({
        where: {
          userId_playgroundId: {
            userId,
            playgroundId: playgroundId,

          },
        },
      });
    }

     revalidatePath("/dashboard");
    return { success: true, isMarked: isChecked };
  } catch (error) {
       console.error("Error updating problem:", error);
    return { success: false, error: "Failed to update problem" };
  }
};

export const getAllPlaygroundForUser = async () => {
  const user = await currentUser();

  try {
    const playground = await db.playground.findMany({
      where: {
        userId: user?.id,
      },
      include: {
        user: true,
        Starmark:{
            where:{
                userId:user?.id!
            },
            select:{
                isMarked:true
            }
        }
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR" | "BLANK";
  description?: string;
}) => {
  const user = await currentUser();

  const { template, title, description } = data;

  try {
    const dbTemplate = template;

    const blankFiles = template === "BLANK" ? [
      {
        content: JSON.stringify({
          folderName: "Root",
          items: [
            {
              filename: "package",
              fileExtension: "json",
              content: JSON.stringify({
                name: title.toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
                version: "1.0.0",
                description: description || "",
                main: "index.js",
                scripts: {
                  start: "node index.js"
                },
                dependencies: {}
              }, null, 2)
            }
          ]
        })
      }
    ] : [];

    const playground = await db.playground.create({
      data: {
        title: title,
        description: description,
        template: dbTemplate,
        userId: user?.id!,
        templateFiles: blankFiles.length ? {
          create: blankFiles
        } : undefined
      },
    });

    return playground;
  } catch (error) {
    console.log(error);
  }
};

export const deleteProjectById = async (id: string) => {
  try {
    // 1. Kill active terminal session if it exists
    try {
      const globalForTerminal = globalThis as unknown as {
        terminalSessions?: Map<string, any>;
      };
      const sessions = globalForTerminal.terminalSessions;
      const session = sessions?.get(id);
      if (session) {
        const pid = session.process.pid;
        if (pid && process.platform === "win32") {
          const { exec } = require("child_process");
          exec(`taskkill /pid ${pid} /f /t`, (err: any) => {
            if (err) console.error("Workspace delete taskkill error:", err);
          });
        } else {
          session.process.kill("SIGKILL");
        }
        sessions?.delete(id);
      }
    } catch (err) {
      console.error("Workspace delete session clean error:", err);
    }

    // 2. Delete from database
    await db.playground.delete({
      where: {
        id,
      },
    });

    // 3. Delete workspace directory recursively from disk
    const fs = await import("fs/promises");
    const path = await import("path");
    const workspacePath = path.join(process.cwd(), "workspaces", id);
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (err) {
      console.error("Workspace folder delete error:", err);
    }

    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string }
) => {
  try {
    await db.playground.update({
      where: {
        id,
      },
      data: data,
    });
    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
  }
};

export const duplicateProjectById = async (id: string) => {
  try {
    const originalPlayground = await db.playground.findUnique({
      where: { id },
      // todo: add tempalte files
    });
    if (!originalPlayground) {
      throw new Error("Original playground not found");
    }

    const duplicatedPlayground = await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId: originalPlayground.userId,

        // todo: add template files
      },
    });

    revalidatePath("/dashboard");
    return duplicatedPlayground;
  } catch (error) {
    console.error("Error duplicating project:", error);
  }
};
