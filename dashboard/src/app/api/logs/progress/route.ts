import { NextResponse } from "next/server";
import fs from "fs";
import { getConfig } from "@/lib/config";
import { parseProgressLog } from "@/lib/progress-parser";
import type { ProgressRecord, ApiResponse } from "@/lib/types";

export async function GET() {
  try {
    const config = getConfig();
    const content = fs.readFileSync(config.progressPath, "utf-8");
    const records = parseProgressLog(content);
    return NextResponse.json({
      data: records,
      error: null,
    } satisfies ApiResponse<ProgressRecord[]>);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json({
        data: [],
        error: null,
      } satisfies ApiResponse<ProgressRecord[]>);
    }
    return NextResponse.json(
      {
        data: null,
        error: "Failed to read progress log",
      } satisfies ApiResponse<ProgressRecord[]>,
      { status: 500 }
    );
  }
}
