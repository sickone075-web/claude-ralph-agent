import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  FileText,
  Globe,
  Server,
  Package,
} from "lucide-react";
import type { RepoStatus } from "@/lib/types";

const typeConfig: Record<
  string,
  { icon: typeof Database; color: string; label: string }
> = {
  docs: { icon: FileText, color: "text-[#F59E0B]", label: "文档" },
  backend: { icon: Server, color: "text-[#C15F3C]", label: "后端" },
  frontend: { icon: Globe, color: "text-[#8B5CF6]", label: "前端" },
  app: { icon: Package, color: "text-[#22C55E]", label: "应用" },
  other: { icon: Database, color: "text-[#B1ADA1]", label: "其他" },
};

const statusStyle: Record<
  string,
  { className: string; label: string }
> = {
  idle: { className: "bg-[#ECEAE5] text-[#666666]", label: "空闲" },
  running: {
    className: "bg-[#FEF0E8] text-[#C15F3C]",
    label: "运行中",
  },
  completed: { className: "bg-[#ECFDF5] text-[#22C55E]", label: "已完成" },
};

export function RepoOverviewCards() {
  const [repos, setRepos] = useState<RepoStatus[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        const json = await res.json();
        if (!cancelled && json.data) {
          setRepos(json.data);
        }
      } catch {
        // ignore
      }
    }

    fetchRepos();
    const interval = setInterval(fetchRepos, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!repos || repos.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[#999999]">仓库概览</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repos.map((repo) => {
          const tc = typeConfig[repo.type] ?? typeConfig.other;
          const ss = statusStyle[repo.status] ?? statusStyle.idle;
          const Icon = tc.icon;
          const percent =
            repo.totalStories > 0
              ? Math.round(
                  (repo.completedStories / repo.totalStories) * 100
                )
              : 0;

          return (
            <Card
              key={repo.name}
              className="bg-white border-[#E0DDD5] card-glow"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${tc.color}`} />
                    <span className="text-sm font-medium text-[#1A1A18]">
                      {repo.name}
                    </span>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 ${tc.color} border border-current bg-transparent`}>
                    {tc.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={ss.className}>
                    {ss.label}
                  </Badge>
                  <span className="text-xs text-[#B1ADA1]">
                    {repo.completedStories}/{repo.totalStories}
                  </span>
                </div>
                {repo.totalStories > 0 && (
                  <div className="w-full bg-[#ECEAE5] rounded-full h-1.5">
                    <div
                      className="bg-[#C15F3C] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
