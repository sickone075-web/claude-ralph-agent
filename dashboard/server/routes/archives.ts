import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getActiveProjectPaths } from "../../src/lib/config";
import { parseProgressLogData } from "../../src/lib/progress-parser";
import type { ArchiveItem, ArchiveDetail, PRD, ProgressLogData } from "../../src/lib/types";

export const archivesRouter = Router();

function getArchiveDir(): string | null {
  const paths = getActiveProjectPaths();
  return paths?.archivePath ?? null;
}

// GET /api/archives
archivesRouter.get("/", (_req: Request, res: Response) => {
  try {
    const archiveDir = getArchiveDir();

    if (!archiveDir || !fs.existsSync(archiveDir)) {
      res.json({ data: [], error: null });
      return;
    }

    const entries = fs.readdirSync(archiveDir, { withFileTypes: true });
    const archives: ArchiveItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderName = entry.name;
      const dateMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : folderName;
      const featureName = dateMatch
        ? folderName.slice(dateMatch[0].length).replace(/^[_-]/, "").replace(/[-_]/g, " ") || folderName
        : folderName;

      let totalStories = 0;
      let completedStories = 0;
      const prdPath = path.join(archiveDir, folderName, "prd.json");
      try {
        const raw = fs.readFileSync(prdPath, "utf-8");
        const prd = JSON.parse(raw) as PRD;
        totalStories = prd.userStories?.length ?? 0;
        completedStories = prd.userStories?.filter((s) => s.passes).length ?? 0;
      } catch {
        // prd.json might not exist
      }

      archives.push({ folder: folderName, date, featureName, totalStories, completedStories });
    }

    archives.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ data: archives, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to read archives directory" });
  }
});

// GET /api/archives/:folder
archivesRouter.get("/:folder", (req: Request, res: Response) => {
  const { folder } = req.params;
  const archiveDir = getArchiveDir();

  if (!archiveDir) {
    res.status(404).json({ data: null, error: "No active project configured" });
    return;
  }

  const folderPath = path.join(archiveDir, folder);

  // Prevent path traversal
  const resolved = path.resolve(folderPath);
  if (!resolved.startsWith(path.resolve(archiveDir))) {
    res.status(400).json({ data: null, error: "Invalid folder path" });
    return;
  }

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    res.status(404).json({ data: null, error: "Archive folder not found" });
    return;
  }

  let prd: PRD | null = null;
  let progress: ProgressLogData | null = null;

  try {
    const prdPath = path.join(folderPath, "prd.json");
    const raw = fs.readFileSync(prdPath, "utf-8");
    prd = JSON.parse(raw) as PRD;
  } catch {
    // prd.json not found
  }

  try {
    const progressPath = path.join(folderPath, "progress.txt");
    const content = fs.readFileSync(progressPath, "utf-8");
    progress = parseProgressLogData(content);
  } catch {
    // progress.txt not found
  }

  res.json({ data: { folder, prd, progress }, error: null });
});
