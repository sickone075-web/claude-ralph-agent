"use client";

import { useState, useEffect } from "react";
import { GitCommitHorizontal, Loader2 } from "lucide-react";
import type { Story, GitCommit } from "@/lib/types";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN");
}

interface StoryGitTabProps {
  story: Story;
  branchName?: string;
}

export function StoryGitTab({ story, branchName }: StoryGitTabProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setCommits([]);
    let url = `/api/git/commits?storyId=${encodeURIComponent(story.id)}`;
    if (branchName) {
      url += `&branch=${encodeURIComponent(branchName)}`;
    }
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setCommits(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [story.id, branchName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{ color: "#B1ADA1" }}
        />
        <p className="mt-3 text-sm" style={{ color: "#B1ADA1" }}>
          加载提交记录中...
        </p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <GitCommitHorizontal
          className="h-10 w-10 mb-3"
          style={{ color: "#B1ADA1" }}
        />
        <p className="text-sm" style={{ color: "#B1ADA1" }}>
          暂无关联的 Git 提交
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {commits.map((commit, i) => (
        <div
          key={commit.hash}
          className="flex flex-col gap-1 px-1 py-3"
          style={{
            borderBottom:
              i < commits.length - 1 ? "1px solid #E0DDD5" : "none",
          }}
        >
          {/* Hash + relative time */}
          <div className="flex items-center justify-between">
            <span
              className="text-[12px] font-semibold"
              style={{
                color: "#C15F3C",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {commit.hash}
            </span>
            <span
              className="text-[11px]"
              style={{
                color: "#999999",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {formatRelativeTime(commit.date)}
            </span>
          </div>
          {/* Commit message */}
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "#1A1A18", fontFamily: "'Inter', sans-serif" }}
          >
            {commit.message}
          </p>
          {/* Author */}
          <span className="text-[12px]" style={{ color: "#666666" }}>
            {commit.author}
          </span>
        </div>
      ))}
    </div>
  );
}
