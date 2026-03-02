import { NextResponse } from "next/server";
import { readPrd, writePrd } from "@/lib/prd-file";
import type { PRD, ApiResponse } from "@/lib/types";

export async function GET() {
  try {
    const prd = readPrd();
    return NextResponse.json({ data: prd, error: null } satisfies ApiResponse<PRD>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<PRD>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to read PRD file" } satisfies ApiResponse<PRD>,
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const prd = readPrd();

    if (typeof body.project === "string") prd.project = body.project;
    if (typeof body.branchName === "string") prd.branchName = body.branchName;
    if (typeof body.description === "string") prd.description = body.description;

    await writePrd(prd);

    return NextResponse.json({ data: prd, error: null } satisfies ApiResponse<PRD>);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { data: null, error: "PRD file not found" } satisfies ApiResponse<PRD>,
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: null, error: "Failed to update PRD" } satisfies ApiResponse<PRD>,
      { status: 500 }
    );
  }
}
