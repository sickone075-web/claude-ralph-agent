import { NextResponse } from "next/server";
import { readPrd, writePrd, getNextStoryId } from "@/lib/prd-file";
import type { Story, ApiResponse } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const repo = new URL(request.url).searchParams.get("repo") || undefined;
    const prd = readPrd(repo);
    const stories: Story[] = prd.userStories ?? [];
    return NextResponse.json({ data: stories, error: null } satisfies ApiResponse<Story[]>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story[]>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to read PRD file" } satisfies ApiResponse<Story[]>,
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const repo = new URL(request.url).searchParams.get("repo") || undefined;
    const body = await request.json();

    if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
      return NextResponse.json(
        { data: null, error: "title is required" } satisfies ApiResponse<Story>,
        { status: 400 }
      );
    }

    const prd = readPrd(repo);
    const newStory: Story = {
      id: getNextStoryId(prd.userStories),
      title: body.title.trim(),
      description: typeof body.description === "string" ? body.description : "",
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : [],
      priority: typeof body.priority === "number" ? body.priority : prd.userStories.length + 1,
      passes: false,
      notes: typeof body.notes === "string" ? body.notes : "",
    };

    prd.userStories.push(newStory);
    await writePrd(prd, repo);

    return NextResponse.json(
      { data: newStory, error: null } satisfies ApiResponse<Story>,
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to create story" } satisfies ApiResponse<Story>,
      { status: 500 }
    );
  }
}
