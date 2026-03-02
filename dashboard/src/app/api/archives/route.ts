import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { ArchiveItem, ApiResponse, PRD } from "@/lib/types";

function getArchiveDir(): string {
  return path.resolve(process.cwd(), "..", "scripts", "ralph", "archive");
}

export async function GET() {
  try {
    const archiveDir = getArchiveDir();

    if (!fs.existsSync(archiveDir)) {
      return NextResponse.json({
        data: [],
        error: null,
      } satisfies ApiResponse<ArchiveItem[]>);
    }

    const entries = fs.readdirSync(archiveDir, { withFileTypes: true });
    const archives: ArchiveItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderName = entry.name;
      // Parse folder name: expected format "YYYY-MM-DD_feature-name" or similar
      const dateMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : folderName;
      const featureName = dateMatch
        ? folderName.slice(dateMatch[0].length).replace(/^[_-]/, "").replace(/[-_]/g, " ") || folderName
        : folderName;

      // Try to read prd.json for stats
      let totalStories = 0;
      let completedStories = 0;
      const prdPath = path.join(archiveDir, folderName, "prd.json");
      try {
        const raw = fs.readFileSync(prdPath, "utf-8");
        const prd = JSON.parse(raw) as PRD;
        totalStories = prd.userStories?.length ?? 0;
        completedStories = prd.userStories?.filter((s) => s.passes).length ?? 0;
      } catch {
        // prd.json might not exist in this archive
      }

      archives.push({
        folder: folderName,
        date,
        featureName,
        totalStories,
        completedStories,
      });
    }

    // Sort by date descending (newest first)
    archives.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      data: archives,
      error: null,
    } satisfies ApiResponse<ArchiveItem[]>);
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Failed to read archives directory",
      } satisfies ApiResponse<ArchiveItem[]>,
      { status: 500 }
    );
  }
}
