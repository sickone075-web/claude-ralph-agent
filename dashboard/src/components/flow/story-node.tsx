"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Check, X, Loader2, Circle } from "lucide-react";
import type { StoryStatus } from "@/lib/types";

export interface StoryNodeData {
  storyId: string;
  title: string;
  status: StoryStatus;
  startedAt?: string;
  completedAt?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function RunningTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Date.now() - new Date(startedAt).getTime()
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <span className="font-mono text-[10px] tabular-nums text-[#C15F3C]">
      {formatDuration(elapsed)}
    </span>
  );
}

const statusConfig: Record<
  StoryStatus,
  {
    cardClass: string;
    iconBg: string;
    icon: React.ReactNode;
    idColor: string;
    titleColor: string;
  }
> = {
  pending: {
    cardClass: "border border-[#E0DDD5] shadow-[0_1px_4px_rgba(0,0,0,0.02)]",
    iconBg: "bg-[#F5F5F0]",
    icon: <Circle className="h-3 w-3 text-[#B1ADA1]" fill="#B1ADA1" />,
    idColor: "text-[#B1ADA1]",
    titleColor: "text-[#B1ADA1]",
  },
  running: {
    cardClass:
      "border-[1.5px] border-[#C15F3C] shadow-[0_0_16px_2px_rgba(193,95,60,0.15)]",
    iconBg: "bg-[#FEF0E8]",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C15F3C]" />,
    idColor: "text-[#C15F3C]",
    titleColor: "text-[#1A1A18]",
  },
  completed: {
    cardClass: "border-[1.5px] border-[#22C55E33] shadow-[0_2px_12px_rgba(0,0,0,0.03)]",
    iconBg: "bg-[#ECFDF5]",
    icon: <Check className="h-3.5 w-3.5 text-[#22C55E]" />,
    idColor: "text-[#22C55E]",
    titleColor: "text-[#1A1A18]",
  },
  failed: {
    cardClass: "border-[1.5px] border-[#EF444433] shadow-[0_2px_12px_rgba(0,0,0,0.03)]",
    iconBg: "bg-[#FEF2F2]",
    icon: <X className="h-3.5 w-3.5 text-[#EF4444]" />,
    idColor: "text-[#EF4444]",
    titleColor: "text-[#1A1A18]",
  },
};

function StoryNodeComponent({ data }: NodeProps & { data: StoryNodeData }) {
  const { storyId, title, status, startedAt, completedAt } = data;
  const config = statusConfig[status];

  const completedDuration =
    status === "completed" && startedAt && completedAt
      ? formatDuration(
          new Date(completedAt).getTime() - new Date(startedAt).getTime()
        )
      : null;

  return (
    <div
      className={`w-[280px] rounded-xl bg-white p-3 transition-all ${config.cardClass} ${
        status === "running" ? "animate-pulse-glow" : ""
      }`}
    >
      {/* Connection handles - target */}
      <Handle type="target" position={Position.Top} id="top" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="target" position={Position.Left} id="left-target" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="target" position={Position.Right} id="right-target" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />

      <div className="flex items-start gap-2.5">
        {/* Status icon circle */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.iconBg}`}
        >
          {config.icon}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header: ID + timer/duration */}
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`font-mono text-[10px] font-semibold ${config.idColor}`}
            >
              {storyId}
            </span>
            <div className="flex items-center gap-1.5">
              {status === "running" && startedAt && (
                <RunningTimer startedAt={startedAt} />
              )}
              {completedDuration && (
                <span className="font-mono text-[10px] tabular-nums text-[#22C55E]">
                  {completedDuration}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <p className={`text-[13px] leading-snug ${config.titleColor}`}>
            {title}
          </p>
        </div>
      </div>

      {/* Source handles */}
      <Handle type="source" position={Position.Bottom} id="bottom" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="source" position={Position.Left} id="left-source" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="source" position={Position.Right} id="right-source" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
    </div>
  );
}

export const StoryNode = memo(StoryNodeComponent);
