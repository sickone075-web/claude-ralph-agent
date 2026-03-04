"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, Radio } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArchiveItem, ArchiveDetail, ApiResponse, Story } from "@/lib/types";

const CURRENT_VALUE = "__current__";

export interface ArchiveSwitcherProps {
  /** Called when switching to an archive; passes the archive stories (read-only) */
  onArchiveSelect: (stories: Story[], archiveLabel: string, branchName?: string) => void;
  /** Called when switching back to the current (live) project */
  onCurrentSelect: () => void;
}

export function ArchiveSwitcher({
  onArchiveSelect,
  onCurrentSelect,
}: ArchiveSwitcherProps) {
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [selected, setSelected] = useState(CURRENT_VALUE);
  const [loading, setLoading] = useState(false);

  // Fetch archive list on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchArchives() {
      try {
        const res = await fetch("/api/archives");
        const json: ApiResponse<ArchiveItem[]> = await res.json();
        if (!cancelled && json.data) {
          setArchives(json.data);
        }
      } catch {
        // silently ignore – dropdown will just show no archives
      }
    }
    fetchArchives();
    return () => { cancelled = true; };
  }, []);

  const handleChange = useCallback(
    async (value: string) => {
      setSelected(value);

      if (value === CURRENT_VALUE) {
        onCurrentSelect();
        return;
      }

      // Fetch archive detail
      setLoading(true);
      try {
        const res = await fetch(`/api/archives/${value}`);
        const json: ApiResponse<ArchiveDetail> = await res.json();
        if (json.data?.prd?.userStories) {
          const archive = archives.find((a) => a.folder === value);
          const label = archive
            ? `${archive.featureName} (${archive.date})`
            : value;
          onArchiveSelect(json.data.prd.userStories, label, json.data.prd.branchName);
        }
      } catch {
        // revert on error
        setSelected(CURRENT_VALUE);
        onCurrentSelect();
      } finally {
        setLoading(false);
      }
    },
    [archives, onArchiveSelect, onCurrentSelect]
  );

  const formatPercent = (item: ArchiveItem) => {
    if (item.totalStories === 0) return "0%";
    return `${Math.round((item.completedStories / item.totalStories) * 100)}%`;
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger className="w-auto min-w-[180px] max-w-[320px] border-[#E0DDD5] bg-white text-[#1A1A18] rounded-lg hover:border-[#ECEAE5] transition-colors">
          <SelectValue placeholder="选择项目">
            {loading ? (
              <span className="flex items-center gap-2 text-[#999999]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中...
              </span>
            ) : selected === CURRENT_VALUE ? (
              <span className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-[#C15F3C]" />
                <span className="text-[#1A1A18] text-sm">当前任务</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Archive className="h-3.5 w-3.5 text-[#999999]" />
                <span className="text-[#1A1A18] text-sm truncate">
                  {archives.find((a) => a.folder === selected)?.featureName ??
                    selected}
                </span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-white border-[#E0DDD5] shadow-lg rounded-lg">
          <SelectGroup>
            <SelectLabel className="text-[#999999] text-xs uppercase tracking-wider">实时</SelectLabel>
            <SelectItem value={CURRENT_VALUE} className="text-[#1A1A18] focus:bg-[#F5F5F0] focus:text-[#1A1A18]">
              <span className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-[#C15F3C]" />
                当前任务
              </span>
            </SelectItem>
          </SelectGroup>

          {archives.length > 0 && (
            <>
              <SelectSeparator className="bg-[#E0DDD5]" />
              <SelectGroup>
                <SelectLabel className="text-[#999999] text-xs uppercase tracking-wider">历史存档</SelectLabel>
                {archives.map((archive) => (
                  <SelectItem
                    key={archive.folder}
                    value={archive.folder}
                    className="text-[#1A1A18] focus:bg-[#F5F5F0] focus:text-[#1A1A18]"
                  >
                    <span className="flex items-center gap-2 w-full">
                      <Archive className="h-3.5 w-3.5 text-[#999999] shrink-0" />
                      <span className="truncate">{archive.featureName}</span>
                      <span className="text-xs text-[#999999] shrink-0">
                        {archive.date}
                      </span>
                      <span className="text-xs font-medium text-[#666666] shrink-0">
                        {formatPercent(archive)}
                      </span>
                      <span className="text-xs text-[#B1ADA1] shrink-0">
                        {archive.completedStories}/{archive.totalStories}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
