import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const githubAccount = await db.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "github",
      },
    });

    if (!githubAccount || !githubAccount.accessToken) {
      return NextResponse.json({ connected: false });
    }

    // Fetch user's GitHub repositories sorted by last updated
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `token ${githubAccount.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DevPilot-IDE",
      },
    });

    if (!res.ok) {
      // If token is invalid or expired, clear it
      if (res.status === 401) {
        await db.account.delete({ where: { id: githubAccount.id } });
      }
      return NextResponse.json({ connected: false });
    }

    const repos = await res.json();
    
    // Check if repos is an array
    if (!Array.isArray(repos)) {
      return NextResponse.json({ connected: false });
    }

    const mapped = repos.map((repo: any) => ({
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      description: repo.description,
      private: repo.private,
    }));

    return NextResponse.json({ connected: true, repos: mapped });
  } catch (error) {
    console.error("GitHub fetch repos error:", error);
    return NextResponse.json({ connected: false });
  }
}
