import { NextResponse } from "next/server";
import { readPrd, writePrd } from "@/lib/prd-file";
import type { Story, ApiResponse } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const prd = readPrd();
    const stories: Story[] = prd.userStories ?? [];
    const story = stories.find((s) => s.id === id);

    if (!story) {
      return NextResponse.json(
        { data: null, error: `Story '${id}' not found` } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }

    return NextResponse.json({ data: story, error: null } satisfies ApiResponse<Story>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to read PRD file" } satisfies ApiResponse<Story>,
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const prd = readPrd();
    const index = prd.userStories.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json(
        { data: null, error: `Story '${id}' not found` } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }

    const existing = prd.userStories[index];
    const updated: Story = {
      id: existing.id,
      title: typeof body.title === "string" ? body.title : existing.title,
      description: typeof body.description === "string" ? body.description : existing.description,
      acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria : existing.acceptanceCriteria,
      priority: typeof body.priority === "number" ? body.priority : existing.priority,
      passes: typeof body.passes === "boolean" ? body.passes : existing.passes,
      notes: typeof body.notes === "string" ? body.notes : existing.notes,
    };

    prd.userStories[index] = updated;
    await writePrd(prd);

    return NextResponse.json({ data: updated, error: null } satisfies ApiResponse<Story>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to update story" } satisfies ApiResponse<Story>,
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const prd = readPrd();
    const index = prd.userStories.findIndex((s) => s.id === id);

    if (index === -1) {
      return NextResponse.json(
        { data: null, error: `Story '${id}' not found` } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }

    const deleted = prd.userStories.splice(index, 1)[0];
    await writePrd(prd);

    return NextResponse.json({ data: deleted, error: null } satisfies ApiResponse<Story>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<Story>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to delete story" } satisfies ApiResponse<Story>,
      { status: 500 }
    );
  }
}
