import { Router, type Request, type Response } from "express";
import fs from "fs";
import { getActiveProjectRepos } from "../../src/lib/config";
import type { PRD } from "../../src/lib/types";

export interface RepoStatus {
  name: string;
  path: string;
  type: string;
  status: "idle" | "running" | "completed";
  completedStories: number;
  totalStories: number;
}

export const reposRouter = Router();

// GET /api/repos
reposRouter.get("/", (_req: Request, res: Response) => {
  try {
    const repos = getActiveProjectRepos();
    if (!repos) {
      res.json({ data: null, error: null });
      return;
    }

    const statuses: RepoStatus[] = repos.map((repo) => {
      let status: RepoStatus["status"] = "idle";
      let completedStories = 0;
      let totalStories = 0;

      try {
        if (fs.existsSync(repo.pidPath)) {
          const pidContent = fs.readFileSync(repo.pidPath, "utf-8").trim();
          if (pidContent) {
            status = "running";
          }
        }
      } catch {
        // ignore
      }

      try {
        if (fs.existsSync(repo.prdPath)) {
          const raw = fs.readFileSync(repo.prdPath, "utf-8");
          const prd = JSON.parse(raw) as PRD;
          const stories = prd.userStories ?? [];
          totalStories = stories.length;
          completedStories = stories.filter((s) => s.passes).length;
          if (status !== "running" && totalStories > 0 && completedStories === totalStories) {
            status = "completed";
          }
        }
      } catch {
        // ignore
      }

      return {
        name: repo.name,
        path: repo.path,
        type: repo.type,
        status,
        completedStories,
        totalStories,
      };
    });

    res.json({ data: statuses, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: String(err) });
  }
});
