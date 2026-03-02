import { NextResponse } from "next/server";
import fs from "fs";
import { getConfig } from "@/lib/config";
import { parseProgressLogData } from "@/lib/progress-parser";
import type { ProgressLogData, ApiResponse } from "@/lib/types";

export async function GET() {
  try {
    const config = getConfig();
    const content = fs.readFileSync(config.progressPath, "utf-8");
    const data = parseProgressLogData(content);
    return NextResponse.json({
      data,
      error: null,
    } satisfies ApiResponse<ProgressLogData>);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json({
        data: { codebasePatterns: [], records: [] },
        error: null,
      } satisfies ApiResponse<ProgressLogData>);
    }
    return NextResponse.json(
      {
        data: null,
        error: "Failed to read progress log",
      } satisfies ApiResponse<ProgressLogData>,
      { status: 500 }
    );
  }
}
