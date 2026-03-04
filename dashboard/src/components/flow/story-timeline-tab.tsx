"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import type { Story, StoryStatus } from "@/lib/types";

// --- Helpers ---

function getEffectiveStatus(story: Story): StoryStatus {
  return story.status ?? (story.passes ? "completed" : "pending");
}

const STATUS_CONFIG: Record<
  StoryStatus,
  { label: string; color: string; bg: string }
> = {
  pending: { label: "待执行", color: "#B1ADA1", bg: "#F5F5F0" },
  running: { label: "执行中", color: "#C15F3C", bg: "#FEF0E8" },
  completed: { label: "已完成", color: "#22C55E", bg: "#ECFDF5" },
  failed: { label: "失败", color: "#EF4444", bg: "#FEF2F2" },
};

interface TimelineEvent {
  status: StoryStatus;
  label: string;
  timestamp: string | null;
  color: string;
}

function buildTimelineEvents(story: Story): TimelineEvent[] {
  const status = getEffectiveStatus(story);
  const events: TimelineEvent[] = [];

  // "Created" event — always present, use startedAt or show as pending
  events.push({
    status: "pending",
    label: "创建任务",
    timestamp: null,
    color: STATUS_CONFIG.pending.color,
  });

  if (story.startedAt) {
    events.push({
      status: "running",
      label: "开始执行",
      timestamp: story.startedAt,
      color: STATUS_CONFIG.running.color,
    });
  }

  if (status === "completed" && story.completedAt) {
    events.push({
      status: "completed",
      label: "执行完成",
      timestamp: story.completedAt,
      color: STATUS_CONFIG.completed.color,
    });
  } else if (status === "failed" && story.completedAt) {
    events.push({
      status: "failed",
      label: "执行失败",
      timestamp: story.completedAt,
      color: STATUS_CONFIG.failed.color,
    });
  }

  return events;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分 ${seconds} 秒`;
  }
  if (minutes > 0) {
    return `${minutes} 分 ${seconds} 秒`;
  }
  return `${seconds} 秒`;
}

function durationBetween(a: string, b: string): string {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return formatDuration(ms);
}

// --- Live Timer Hook ---

function useLiveElapsed(startedAt: string | undefined, active: boolean): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active || !startedAt) {
      setElapsed(null);
      return;
    }

    const update = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      setElapsed(formatDuration(ms));
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, active]);

  return elapsed;
}

// --- Component ---

interface StoryTimelineTabProps {
  story: Story;
}

export function StoryTimelineTab({ story }: StoryTimelineTabProps) {
  const status = getEffectiveStatus(story);
  const events = buildTimelineEvents(story);
  const isRunning = status === "running";
  const liveElapsed = useLiveElapsed(story.startedAt, isRunning);

  // Total duration
  let totalDuration: string | null = null;
  if (story.startedAt && story.completedAt) {
    totalDuration = durationBetween(story.startedAt, story.completedAt);
  }

  if (events.length <= 1 && !story.startedAt) {
    // Only "created" event, no real timeline data
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Clock className="h-10 w-10 mb-3" style={{ color: "#B1ADA1" }} />
        <p className="text-sm" style={{ color: "#B1ADA1" }}>
          暂无执行记录
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {/* Total duration summary */}
      {(totalDuration || liveElapsed) && (
        <div
          className="mb-6 px-4 py-3 rounded-lg"
          style={{ backgroundColor: "#FAFAF7" }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-[1px] block mb-1"
            style={{ color: "#999999", fontFamily: "'Inter', sans-serif" }}
          >
            总耗时
          </span>
          <span
            className="text-[16px] font-semibold"
            style={{
              color: isRunning ? "#C15F3C" : "#1A1A18",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {isRunning ? liveElapsed : totalDuration}
          </span>
        </div>
      )}

      {/* Vertical Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div
          className="absolute left-[9px] top-2 bottom-2"
          style={{ width: "2px", backgroundColor: "#E0DDD5" }}
        />

        {events.map((event, i) => {
          const isLast = i === events.length - 1;
          const isActive = isLast && isRunning;

          // Duration between this event and the previous one
          let durationLabel: string | null = null;
          if (i > 0 && events[i - 1].timestamp && event.timestamp) {
            durationLabel = durationBetween(
              events[i - 1].timestamp!,
              event.timestamp
            );
          }

          return (
            <div key={i}>
              {/* Duration between events */}
              {durationLabel && (
                <div className="relative flex items-center py-2 pl-8">
                  <span
                    className="text-[12px]"
                    style={{
                      color: "#666666",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    耗时 {durationLabel}
                  </span>
                </div>
              )}

              {/* Event node */}
              <div className="relative flex items-start gap-4 pb-6">
                {/* Dot */}
                <div
                  className="relative z-10 flex items-center justify-center shrink-0"
                  style={{ width: "20px", height: "20px" }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: isActive ? "12px" : "10px",
                      height: isActive ? "12px" : "10px",
                      backgroundColor: event.color,
                      boxShadow: isActive
                        ? `0 0 8px 2px ${event.color}40`
                        : "none",
                      animation: isActive
                        ? "timeline-pulse 2s ease-in-out infinite"
                        : "none",
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 -mt-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] font-medium"
                      style={{
                        color: "#1A1A18",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {event.label}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: STATUS_CONFIG[event.status].bg,
                        color: STATUS_CONFIG[event.status].color,
                      }}
                    >
                      {STATUS_CONFIG[event.status].label}
                    </span>
                  </div>
                  {event.timestamp && (
                    <span
                      className="text-[11px] mt-0.5 block"
                      style={{
                        color: "#999999",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {formatTimestamp(event.timestamp)}
                    </span>
                  )}
                  {/* Live elapsed for running */}
                  {isActive && liveElapsed && (
                    <span
                      className="text-[12px] mt-1 block font-medium"
                      style={{
                        color: "#C15F3C",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      已运行 {liveElapsed}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pulse animation */}
      {isRunning && (
        <style>{`
          @keyframes timeline-pulse {
            0%, 100% { box-shadow: 0 0 4px 1px rgba(193,95,60,0.15); }
            50% { box-shadow: 0 0 12px 4px rgba(193,95,60,0.3); }
          }
        `}</style>
      )}
    </div>
  );
}
