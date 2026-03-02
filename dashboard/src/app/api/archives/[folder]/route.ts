import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseProgressLogData } from "@/lib/progress-parser";
import type { ArchiveDetail, ApiResponse, PRD, ProgressLogData } from "@/lib/types";

function getArchiveDir(): string {
  return path.resolve(process.cwd(), "..", "scripts", "ralph", "archive");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folder: string }> }
) {
  const { folder } = await params;
  const archiveDir = getArchiveDir();
  const folderPath = path.join(archiveDir, folder);

  // Prevent path traversal
  const resolved = path.resolve(folderPath);
  if (!resolved.startsWith(path.resolve(archiveDir))) {
    return NextResponse.json(
      { data: null, error: "Invalid folder path" } satisfies ApiResponse<ArchiveDetail>,
      { status: 400 }
    );
  }

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return NextResponse.json(
      { data: null, error: "Archive folder not found" } satisfies ApiResponse<ArchiveDetail>,
      { status: 404 }
    );
  }

  let prd: PRD | null = null;
  let progress: ProgressLogData | null = null;

  try {
    const prdPath = path.join(folderPath, "prd.json");
    const raw = fs.readFileSync(prdPath, "utf-8");
    prd = JSON.parse(raw) as PRD;
  } catch {
    // prd.json not found in archive
  }

  try {
    const progressPath = path.join(folderPath, "progress.txt");
    const content = fs.readFileSync(progressPath, "utf-8");
    progress = parseProgressLogData(content);
  } catch {
    // progress.txt not found in archive
  }

  return NextResponse.json({
    data: {
      folder,
      prd,
      progress,
    },
    error: null,
  } satisfies ApiResponse<ArchiveDetail>);
}
