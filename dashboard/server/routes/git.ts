import { Router, type Request, type Response } from "express";
import path from "path";
import { simpleGit } from "simple-git";
import { getActiveProjectPaths } from "../../src/lib/config";
import type { GitCommit } from "../../src/lib/types";

export const gitRouter = Router();

// GET /api/git/commits?storyId=US-001&branch=ralph/dashboard-restructure
gitRouter.get("/commits", async (req: Request, res: Response) => {
  try {
    const storyId = req.query.storyId as string | undefined;
    const branch = req.query.branch as string | undefined;
    const paths = getActiveProjectPaths();
    const projectRoot = paths?.projectPath ?? path.resolve(process.cwd(), "..");
    const git = simpleGit(projectRoot);

    let log;
    if (branch) {
      // Only show commits on this branch relative to main
      const opts: Record<string, unknown> = {
        maxCount: storyId ? 100 : 50,
        from: "main",
        to: branch,
      };
      if (storyId) opts["--grep"] = storyId;
      try {
        log = await git.log(opts);
      } catch {
        // Fallback if branch range fails (e.g. main doesn't exist)
        const fallback: Record<string, unknown> = { maxCount: storyId ? 100 : 50 };
        if (storyId) fallback["--grep"] = storyId;
        log = await git.log(fallback);
      }
    } else if (storyId) {
      log = await git.log({ maxCount: 100, "--grep": storyId });
    } else {
      log = await git.log({ maxCount: 50 });
    }

    const commits: GitCommit[] = log.all.map((entry) => ({
      hash: entry.hash.slice(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));

    res.json({ data: commits, error: null });
  } catch {
    res.status(500).json({ data: null, error: "Failed to query git commits" });
  }
});
