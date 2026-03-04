"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RalphStatus } from "@/lib/store";

export interface StartNodeData {
  projectName: string;
  description: string;
  completedCount: number;
  totalCount: number;
  ralphStatus: RalphStatus;
  branchName?: string;
  iteration?: number;
  totalIterations?: number;
}

const statusBadge: Record<RalphStatus, { className: string; label: string }> = {
  idle: { className: "bg-[#F5F5F0] text-[#B1ADA1]", label: "空闲" },
  running: {
    className: "bg-[#FEF0E8] text-[#C15F3C]",
    label: "运行中",
  },
  completed: { className: "bg-[#ECFDF5] text-[#22C55E]", label: "已完成" },
  error: { className: "bg-[#FEF2F2] text-[#EF4444]", label: "错误" },
};

function StartNodeComponent({ data }: NodeProps & { data: StartNodeData }) {
  const {
    projectName,
    description,
    completedCount,
    totalCount,
    ralphStatus,
    branchName,
    iteration,
    totalIterations,
  } = data;

  const percent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const badge = statusBadge[ralphStatus];

  return (
    <div className="w-[320px] rounded-xl bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      {/* Header row: icon + project info */}
      <div className="flex items-start gap-3">
        {/* Terracotta icon square */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C15F3C]">
          <Play className="h-5 w-5 text-white" fill="white" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Project name */}
          <h3
            className="mb-0.5 text-base leading-snug text-[#1A1A18]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {projectName}
          </h3>

          {/* Status badge */}
          <Badge className={`${badge.className} rounded-full text-[10px] font-medium`}>
            {ralphStatus === "running" &&
            totalIterations != null &&
            totalIterations > 0
              ? `${badge.label} (${iteration ?? 0}/${totalIterations})`
              : badge.label}
          </Badge>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-2 line-clamp-2 text-xs text-[#666666]">{description}</p>
      )}

      {/* Progress bar */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[#666666]">
            {completedCount} / {totalCount} 完成
          </span>
          <span className="font-mono text-[10px] font-semibold text-[#C15F3C]">
            {percent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ECEAE5]">
          <div
            className="h-full rounded-full bg-[#C15F3C] transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Branch name */}
      {branchName && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F5F5F0] px-2 py-1">
          <GitBranch className="h-3 w-3 text-[#B1ADA1]" />
          <span className="truncate font-mono text-xs text-[#666666]">
            {branchName}
          </span>
        </div>
      )}

      {/* Connection handles */}
      <Handle type="source" position={Position.Bottom} id="bottom" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="source" position={Position.Right} id="right" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="source" position={Position.Left} id="left" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
    </div>
  );
}

export const StartNode = memo(StartNodeComponent);
