
import { useState, useCallback } from "react";
import { LayoutDashboard } from "lucide-react";
import { ArchiveSwitcher } from "@/components/flow/archive-switcher";
import { ProjectSwitcher } from "@/components/project-switcher";
import { StoryFlow } from "@/components/flow/story-flow";
import { RepoOverviewCards } from "@/components/repo-overview-cards";
import { useDashboardStore } from "@/lib/store";
import type { Story } from "@/lib/types";

export default function DashboardPage() {
  const { prd, ralphStatus, iteration, totalIterations } =
    useDashboardStore();

  // Archive state: when viewing an archive, stories come from the archive
  const [archiveStories, setArchiveStories] = useState<Story[] | null>(null);
  const [archiveLabel, setArchiveLabel] = useState<string | null>(null);
  const [archiveBranchName, setArchiveBranchName] = useState<string | undefined>(undefined);

  const isViewingArchive = archiveStories !== null;

  const handleArchiveSelect = useCallback(
    (stories: Story[], label: string, branchName?: string) => {
      setArchiveStories(stories);
      setArchiveLabel(label);
      setArchiveBranchName(branchName);
    },
    []
  );

  const handleCurrentSelect = useCallback(() => {
    setArchiveStories(null);
    setArchiveLabel(null);
    setArchiveBranchName(undefined);
  }, []);

  if (!prd) {
    return (
      <div className="flex flex-col h-full">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0DDD5] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-[#B1ADA1]" />
            <h1 className="text-xl font-semibold text-[#1A1A18]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>仪表盘</h1>
          </div>
          <div className="h-9 w-[200px] bg-[#F5F5F0] rounded-lg animate-pulse" />
        </div>

        {/* Flow Canvas Skeleton */}
        <div className="flex-1 flex items-center justify-center bg-[#F5F5F0]">
          <div className="space-y-6">
            {/* Start node skeleton */}
            <div className="w-[320px] h-[180px] bg-white rounded-xl shadow-sm animate-pulse" />
            {/* Story node skeletons */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="w-px h-6 bg-[#E0DDD5]" />
                <div className="w-[280px] h-[72px] bg-white rounded-xl shadow-sm animate-pulse" />
              </div>
            ))}
            {/* End node skeleton */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-px h-6 bg-[#E0DDD5]" />
              <div className="w-[280px] h-[80px] bg-white rounded-xl border border-dashed border-[#E0DDD5] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stories = isViewingArchive ? archiveStories : (prd.userStories ?? []);
  const effectiveBranchName = isViewingArchive ? archiveBranchName : prd.branchName;

  // Determine which story Ralph is currently working on (only for live view)
  const currentStoryId =
    !isViewingArchive && ralphStatus === "running"
      ? stories.find((s) => !s.passes)?.id ?? undefined
      : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header with Project Switcher + Archive Switcher */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0DDD5] bg-white shrink-0">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-[#B1ADA1]" />
          <h1 className="text-xl font-semibold text-[#1A1A18]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            仪表盘
            {archiveLabel && (
              <span className="text-base font-normal text-[#999999] ml-2">
                — {archiveLabel}
              </span>
            )}
          </h1>
          <div className="ml-2">
            <ProjectSwitcher />
          </div>
        </div>
        <ArchiveSwitcher
          onArchiveSelect={handleArchiveSelect}
          onCurrentSelect={handleCurrentSelect}
        />
      </div>

      {/* Repo Overview Cards (multi-repo only) */}
      <RepoOverviewCards />

      {/* Full-screen Flow Canvas */}
      <div className="flex-1 min-h-0">
        <StoryFlow
          stories={stories}
          projectName={prd.project ?? "加载中..."}
          description={prd.description ?? ""}
          branchName={effectiveBranchName}
          ralphStatus={isViewingArchive ? "idle" : ralphStatus}
          iteration={isViewingArchive ? undefined : iteration}
          totalIterations={isViewingArchive ? undefined : totalIterations}
          currentStoryId={currentStoryId}
          readOnly={isViewingArchive}
        />
      </div>
    </div>
  );
}
