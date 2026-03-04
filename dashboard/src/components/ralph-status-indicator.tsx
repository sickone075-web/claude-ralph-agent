import { useDashboardStore } from "@/lib/store";
import type { RalphStatus } from "@/lib/store";

const statusConfig: Record<
  RalphStatus,
  { color: string; label: string; animate: boolean }
> = {
  idle: { color: "bg-[#B1ADA1]", label: "空闲", animate: false },
  running: { color: "bg-[#C15F3C]", label: "运行中", animate: true },
  completed: { color: "bg-[#22C55E]", label: "已完成", animate: false },
  error: { color: "bg-[#EF4444]", label: "错误", animate: false },
};

export function RalphStatusIndicator({ compact }: { compact?: boolean }) {
  const { ralphStatus, iteration, totalIterations } = useDashboardStore();
  const config = statusConfig[ralphStatus];

  if (compact) {
    return (
      <div
        className={`rounded-full ${config.color} ${
          config.animate ? "animate-pulse" : ""
        }`}
        style={{ width: 10, height: 10 }}
        title={config.label}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${config.color} ${
          config.animate ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs text-[#999999]">
        {config.label}
        {ralphStatus === "running" && totalIterations > 0 && (
          <span className="ml-1 text-[#B1ADA1]">
            ({iteration}/{totalIterations})
          </span>
        )}
      </span>
    </div>
  );
}
