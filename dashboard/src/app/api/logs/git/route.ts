import { NextResponse } from "next/server";
import path from "path";
import { simpleGit } from "simple-git";
import type { GitCommit, ApiResponse } from "@/lib/types";

export async function GET() {
  try {
    const projectRoot = path.resolve(process.cwd(), "..");
    const git = simpleGit(projectRoot);
    const log = await git.log({ maxCount: 50 });

    const commits: GitCommit[] = log.all.map((entry) => ({
      hash: entry.hash.slice(0, 7),
      message: entry.message,
      date: entry.date,
      author: entry.author_name,
    }));

    return NextResponse.json({
      data: commits,
      error: null,
    } satisfies ApiResponse<GitCommit[]>);
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: "Failed to read git history",
      } satisfies ApiResponse<GitCommit[]>,
      { status: 500 }
    );
  }
}
