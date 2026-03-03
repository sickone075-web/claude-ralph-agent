import fs from "fs";
import { getActiveProjectPaths, getActiveProjectRepos } from "@/lib/config";
import type { PRD } from "@/lib/types";

let writeLock = false;

async function acquireLock(): Promise<void> {
  while (writeLock) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  writeLock = true;
}

function releaseLock(): void {
  writeLock = false;
}

function getPrdPath(repoName?: string): string {
  if (repoName) {
    const repos = getActiveProjectRepos();
    const repo = repos?.find((r) => r.name === repoName);
    if (!repo) {
      throw Object.assign(new Error(`Repository '${repoName}' not found`), { code: "ENOENT" });
    }
    return repo.prdPath;
  }
  const paths = getActiveProjectPaths();
  if (!paths) {
    throw Object.assign(new Error("No active project configured"), { code: "ENOENT" });
  }
  return paths.prdPath;
}

export function readPrd(repoName?: string): PRD {
  const prdPath = getPrdPath(repoName);
  const raw = fs.readFileSync(prdPath, "utf-8");
  return JSON.parse(raw) as PRD;
}

export async function writePrd(prd: PRD, repoName?: string): Promise<void> {
  const prdPath = getPrdPath(repoName);
  const tmpPath = prdPath + ".tmp";

  await acquireLock();
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(prd, null, 2) + "\n", "utf-8");
    fs.renameSync(tmpPath, prdPath);
  } finally {
    releaseLock();
  }
}

export function getNextStoryId(stories: PRD["userStories"]): string {
  let maxNum = 0;
  for (const story of stories) {
    const match = story.id.match(/^US-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `US-${String(maxNum + 1).padStart(3, "0")}`;
}
