import { useDashboardStore } from "@/lib/store";
import type { RalphStatus } from "@/lib/store";

const statusConfig: Record<
  RalphStatus,
  { color: string; label: string; animate: boolean }
> = {
  idle: { color: "bg-zinc-500", label: "空闲", animate: false },
  running: { color: "bg-cyan-500", label: "运行中", animate: true },
  completed: { color: "bg-blue-500", label: "已完成", animate: false },
  error: { color: "bg-red-500", label: "错误", animate: false },
};

export function RalphStatusIndicator() {
  const { ralphStatus, iteration, totalIterations } = useDashboardStore();
  const config = statusConfig[ralphStatus];

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${config.color} ${
          config.animate ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs text-zinc-400">
        {config.label}
        {ralphStatus === "running" && totalIterations > 0 && (
          <span className="ml-1 text-zinc-500">
            ({iteration}/{totalIterations})
          </span>
        )}
      </span>
    </div>
  );
}
