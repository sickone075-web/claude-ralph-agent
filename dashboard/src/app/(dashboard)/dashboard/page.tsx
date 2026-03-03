"use client";

import { useCallback } from "react";
import {
  LayoutDashboard,
  GitBranch,
  CheckCircle2,
  Clock,
  ListTodo,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/kanban-board";
import { SkeletonCard } from "@/components/skeleton-card";
import { RepoOverviewCards } from "@/components/repo-overview-cards";
import { useDashboardStore } from "@/lib/store";
import type { RalphStatus } from "@/lib/store";
import type { Story } from "@/lib/types";

const statusBadge: Record<RalphStatus, { className: string; label: string }> = {
  idle: { className: "bg-zinc-700 text-zinc-300", label: "空闲" },
  running: { className: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white", label: "运行中" },
  completed: { className: "bg-blue-900 text-blue-300", label: "已完成" },
  error: { className: "bg-red-900 text-red-300", label: "错误" },
};

function CircularProgress({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative h-16 w-16">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-zinc-800"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-200">
        {percent}%
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { prd, ralphStatus, iteration, totalIterations, setPrd } =
    useDashboardStore();

  const handleUpdateStory = useCallback(
    async (updated: Partial<Story>) => {
      if (!updated.id) return;
      try {
        const res = await fetch(`/api/prd/stories/${updated.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        const json = await res.json();
        if (json.data && prd) {
          const updatedStories = prd.userStories.map((s) =>
            s.id === updated.id ? { ...s, ...updated } : s
          );
          setPrd({ ...prd, userStories: updatedStories });
        }
      } catch {
        // WebSocket prd:updated will sync eventually
      }
    },
    [prd, setPrd]
  );

  if (!prd) {
    return (
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-zinc-400" />
          <h1 className="text-2xl font-semibold text-zinc-100">仪表盘</h1>
        </div>

        {/* Stats Skeleton - Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Project Info Skeleton - col-span-2 row-span-2 */}
          <div className="col-span-2 row-span-2 skeleton rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="h-5 w-24 bg-zinc-700/50 rounded mb-3 animate-pulse" />
              <div className="h-7 w-48 bg-zinc-700/50 rounded mb-2 animate-pulse" />
              <div className="h-4 w-64 bg-zinc-700/50 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div className="h-16 w-16 bg-zinc-700/50 rounded-full animate-pulse" />
              <div>
                <div className="h-4 w-16 bg-zinc-700/50 rounded mb-1 animate-pulse" />
                <div className="h-3 w-20 bg-zinc-700/50 rounded animate-pulse" />
              </div>
            </div>
          </div>
          {/* 4 Stat Card Skeletons */}
          <SkeletonCard className="h-[72px]" />
          <SkeletonCard className="h-[72px]" />
          <SkeletonCard className="h-[72px]" />
          <SkeletonCard className="h-[72px]" />
        </div>

        {/* Kanban Skeleton - 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["待处理", "进行中", "已完成"].map((title) => (
            <div key={title} className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-3 bg-zinc-700/50 rounded-full animate-pulse" />
                <div className="h-4 w-16 bg-zinc-700/50 rounded animate-pulse" />
              </div>
              <SkeletonCard className="h-24" />
              <SkeletonCard className="h-24" />
              {title === "待处理" && <SkeletonCard className="h-24" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stories = prd.userStories ?? [];
  const total = stories.length;
  const completedCount = stories.filter((s) => s.passes).length;
  const pendingCount = total - completedCount;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Determine which story Ralph is currently working on
  const currentStoryId =
    ralphStatus === "running"
      ? stories.find((s) => !s.passes)?.id ?? null
      : null;

  const badge = statusBadge[ralphStatus];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold text-zinc-100">
          仪表盘
        </h1>
      </div>

      {/* Stats - Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Project Info Card - spans 2 cols and 2 rows */}
        <Card className="bg-zinc-900 border-zinc-800 card-glow col-span-2 row-span-2">
          <CardContent className="flex flex-col justify-between h-full p-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LayoutDashboard className="h-5 w-5 text-cyan-500" />
                <Badge className={badge.className}>
                  {ralphStatus === "running" && totalIterations > 0
                    ? `${badge.label} (${iteration}/${totalIterations})`
                    : badge.label}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-1">
                {prd?.project ?? "加载中..."}
              </h2>
              {prd?.description && (
                <p className="text-sm text-zinc-500 line-clamp-2">
                  {prd.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <CircularProgress percent={percent} />
              <div>
                <p className="text-sm font-medium text-zinc-300">完成进度</p>
                <p className="text-xs text-zinc-500">
                  {completedCount} / {total} 个故事
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right side - 4 stat cards */}
        <Card className="bg-zinc-900 border-zinc-800 card-glow">
          <CardContent className="flex items-center gap-3 p-4">
            <ListTodo className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{total}</p>
              <p className="text-xs text-zinc-500">总故事数</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 card-glow">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{completedCount}</p>
              <p className="text-xs text-zinc-500">已完成</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 card-glow">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{pendingCount}</p>
              <p className="text-xs text-zinc-500">待处理</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 card-glow">
          <CardContent className="flex items-center gap-3 p-4">
            {prd?.branchName && (
              <>
                <GitBranch className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-mono font-bold text-zinc-100 truncate">{prd.branchName}</p>
                  <p className="text-xs text-zinc-500">当前分支</p>
                </div>
              </>
            )}
            {!prd?.branchName && (
              <>
                <GitBranch className="h-5 w-5 text-zinc-400" />
                <div>
                  <p className="text-sm font-mono font-bold text-zinc-500">—</p>
                  <p className="text-xs text-zinc-500">当前分支</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Repo Overview Cards (multi-repo only) */}
      <RepoOverviewCards />

      {/* Kanban Board */}
      <KanbanBoard
        stories={stories}
        currentStoryId={currentStoryId}
        ralphRunning={ralphStatus === "running"}
        onUpdateStory={handleUpdateStory}
      />
    </div>
  );
}
