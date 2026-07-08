import { db } from "@/lib/db";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playgroundId = req.nextUrl.searchParams.get("playgroundId");
    if (!playgroundId) {
      return NextResponse.json({ error: "Missing playgroundId" }, { status: 400 });
    }

    const messages = await db.chatMessage.findMany({
      where: {
        playgroundId,
        userId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error("GET chat history error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { playgroundId, messages } = await req.json();
    if (!playgroundId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Replace the chat history with the updated list to keep client/server in sync
    await db.chatMessage.deleteMany({
      where: {
        playgroundId,
        userId,
      },
    });

    if (messages.length > 0) {
      await db.chatMessage.createMany({
        data: messages.map((msg: any) => ({
          userId,
          playgroundId,
          role: msg.role,
          content: msg.content,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST chat history error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playgroundId = req.nextUrl.searchParams.get("playgroundId");
    if (!playgroundId) {
      return NextResponse.json({ error: "Missing playgroundId" }, { status: 400 });
    }

    await db.chatMessage.deleteMany({
      where: {
        playgroundId,
        userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE chat history error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
