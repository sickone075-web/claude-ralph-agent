"use client";

import type { Story } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Check, Circle, Clock, FileText, Tag, MessageSquare } from "lucide-react";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const priorityColors: Record<number, string> = {
  1: "bg-red-500/20 text-red-400 border-red-500/30",
  2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  3: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function getPriorityClass(priority: number): string {
  return priorityColors[priority] ?? "bg-zinc-700/40 text-zinc-300 border-zinc-600/30";
}

interface StoryDetailPanelProps {
  story: Story | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function StoryDetailPanel({
  story,
  open,
  onOpenChange,
}: StoryDetailPanelProps) {
  if (!story) return null;

  const duration =
    story.startedAt && story.completedAt
      ? formatDuration(
          new Date(story.completedAt).getTime() -
            new Date(story.startedAt).getTime()
        )
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[360px] sm:max-w-[360px] overflow-y-auto bg-zinc-950 border-zinc-800"
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-cyan-400">
              {story.id}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getPriorityClass(story.priority)}`}
            >
              P{story.priority}
            </span>
            {story.passes ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-xs text-green-400">
                <Check className="h-3 w-3" />
                已完成
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/40 border border-zinc-600/30 px-2 py-0.5 text-xs text-zinc-400">
                <Circle className="h-3 w-3" />
                未完成
              </span>
            )}
          </div>
          <SheetTitle className="text-base text-zinc-100">
            {story.title}
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {story.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {/* Acceptance Criteria */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
              <FileText className="h-4 w-4 text-zinc-500" />
              验收标准
            </h3>
            <ul className="space-y-2">
              {story.acceptanceCriteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 flex-shrink-0">
                    {story.passes ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-600" />
                    )}
                  </div>
                  <span className="text-sm text-zinc-400">{criterion}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Time Info */}
          {(story.startedAt || story.completedAt) && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                <Clock className="h-4 w-4 text-zinc-500" />
                时间信息
              </h3>
              <div className="space-y-1.5 text-sm">
                {story.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">开始时间</span>
                    <span className="text-zinc-300 tabular-nums">
                      {formatTimestamp(story.startedAt)}
                    </span>
                  </div>
                )}
                {story.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">完成时间</span>
                    <span className="text-zinc-300 tabular-nums">
                      {formatTimestamp(story.completedAt)}
                    </span>
                  </div>
                )}
                {duration && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">耗时</span>
                    <span className="font-medium text-cyan-400 tabular-nums">
                      {duration}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Priority */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
              <Tag className="h-4 w-4 text-zinc-500" />
              优先级
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium ${getPriorityClass(story.priority)}`}
            >
              Priority {story.priority}
            </span>
          </section>

          {/* Notes */}
          {story.notes && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-300">
                <MessageSquare className="h-4 w-4 text-zinc-500" />
                备注
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {story.notes}
              </p>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
