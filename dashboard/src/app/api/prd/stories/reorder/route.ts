import { NextResponse } from "next/server";
import { readPrd, writePrd } from "@/lib/prd-file";
import type { Story, ApiResponse } from "@/lib/types";

interface ReorderItem {
  id: string;
  priority: number;
}

export async function PATCH(request: Request) {
  try {
    const repo = new URL(request.url).searchParams.get("repo") || undefined;
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { data: null, error: "Request body must be an array of { id, priority }" } satisfies ApiResponse<Story[]>,
        { status: 400 }
      );
    }

    const prd = readPrd(repo);

    for (const item of body as ReorderItem[]) {
      if (typeof item.id !== "string" || typeof item.priority !== "number") continue;
      const story = prd.userStories.find((s) => s.id === item.id);
      if (story) {
        story.priority = item.priority;
      }
    }

    await writePrd(prd, repo);

    return NextResponse.json({
      data: prd.userStories,
      error: null,
    } satisfies ApiResponse<Story[]>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story[]>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to reorder stories" } satisfies ApiResponse<Story[]>,
      { status: 500 }
    );
  }
}
