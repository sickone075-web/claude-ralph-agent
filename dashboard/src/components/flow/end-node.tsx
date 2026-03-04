"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";

export interface EndNodeData {
  completedCount: number;
  totalCount: number;
  firstStartedAt?: string;
  lastCompletedAt?: string;
}

function EndNodeComponent({ data }: NodeProps & { data: EndNodeData }) {
  const { completedCount, totalCount } = data;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <div
      className={`flex h-16 w-[120px] items-center justify-center rounded-xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
        allCompleted
          ? "border-[1.5px] border-[#22C55E33]"
          : "border border-[#E0DDD5]"
      }`}
    >
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} id="top" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="target" position={Position.Left} id="left-target" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />
      <Handle type="target" position={Position.Right} id="right-target" className="!h-2 !w-2 !border-[#E0DDD5] !bg-[#C15F3C]" />

      <div className="flex items-center gap-1.5">
        <Flag
          className={`h-4 w-4 ${allCompleted ? "text-[#22C55E]" : "text-[#B1ADA1]"}`}
        />
        <span
          className={`text-sm font-medium ${allCompleted ? "text-[#22C55E]" : "text-[#B1ADA1]"}`}
        >
          End
        </span>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
