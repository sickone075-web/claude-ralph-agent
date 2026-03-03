import { NextResponse } from "next/server";
import fs from "fs";
import { getActiveProjectRepos } from "@/lib/config";
import type { PRD } from "@/lib/types";

export interface RepoStatus {
  name: string;
  path: string;
  type: string;
  status: "idle" | "running" | "completed";
  completedStories: number;
  totalStories: number;
}

export async function GET() {
  try {
    const repos = getActiveProjectRepos();
    if (!repos) {
      return NextResponse.json({ data: null, error: null });
    }

    const statuses: RepoStatus[] = repos.map((repo) => {
      let status: RepoStatus["status"] = "idle";
      let completedStories = 0;
      let totalStories = 0;

      // Check PID file for running status
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

      // Read prd.json for story progress
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

    return NextResponse.json({ data: statuses, error: null });
  } catch (err) {
    return NextResponse.json(
      { data: null, error: String(err) },
      { status: 500 }
    );
  }
}
