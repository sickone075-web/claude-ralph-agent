import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getActiveProjectPaths } from "../../src/lib/config";
import { parseProgressLogData } from "../../src/lib/progress-parser";
import type { GitCommit, ProgressLogData } from "../../src/lib/types";
import { getAllLogs, getLogsByStoryId } from "../log-cache";

export const logsRouter = Router();

// GET /api/logs — return all execution logs (not filtered by story)
logsRouter.get("/", (_req: Request, res: Response) => {
  const data = getAllLogs();
  res.json({ data, error: null });
});

// GET /api/logs/progress
logsRouter.get("/progress", (_req: Request, res: Response) => {
  try {
    const paths = getActiveProjectPaths();
    if (!paths) {
      res.json({
        data: { codebasePatterns: [], records: [] },
        error: null,
      });
      return;
    }
    const content = fs.readFileSync(paths.progressPath, "utf-8");
    const data = parseProgressLogData(content);
    res.json({ data, error: null });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      res.json({
        data: { codebasePatterns: [], records: [] },
        error: null,
      });
      return;
    }
    res.status(500).json({ data: null, error: "Failed to read progress log" });
  }
});

// GET /api/logs/git
logsRouter.get("/git", async (_req: Request, res: Response) => {
  try {
    const paths = getActiveProjectPaths();
    const projectRoot = paths?.projectPath ?? path.resolve(process.cwd(), "..");
    const git = simpleGit(projectRoot);
    const log = await git.log({ maxCount: 50 });

    const commits: GitCommit[] = log.all.map((entry) => ({
      hash: entry.hash.slice(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));

    res.json({ data: commits, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to read git history" });
  }
});

// GET /api/logs/:storyId — return execution logs for a specific story
// NOTE: This must come AFTER /progress and /git to avoid matching those paths
logsRouter.get("/:storyId", (req: Request, res: Response) => {
  const storyId = req.params.storyId as string;
  const data = getLogsByStoryId(storyId);
  res.json({ data, error: null });
});
