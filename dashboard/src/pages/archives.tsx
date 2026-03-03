
import { useState, useEffect, useCallback } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  FileCode2,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StoryFlow } from "@/components/flow/story-flow";
import type { ArchiveItem, ArchiveDetail, ProgressLogData } from "@/lib/types";

// Height constants matching story-flow.tsx
const START_NODE_HEIGHT = 200;
const STORY_NODE_HEIGHT = 80;
const END_NODE_HEIGHT = 100;
const NODE_GAP = 100;
const FLOW_PADDING = 80; // extra padding for fitView margins

function calcFlowHeight(storyCount: number): number {
  return (
    START_NODE_HEIGHT +
    NODE_GAP +
    storyCount * (STORY_NODE_HEIGHT + NODE_GAP) +
    END_NODE_HEIGHT +
    FLOW_PADDING
  );
}

export default function ArchivesPage() {
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [archiveDetail, setArchiveDetail] = useState<ArchiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchArchives = useCallback(async () => {
    try {
      const res = await fetch("/api/archives");
      const json = await res.json();
      if (json.data) setArchives(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  async function handleToggle(folder: string) {
    if (expandedFolder === folder) {
      setExpandedFolder(null);
      setArchiveDetail(null);
      return;
    }

    setExpandedFolder(folder);
    setDetailLoading(true);
    setArchiveDetail(null);

    try {
      const res = await fetch(`/api/archives/${encodeURIComponent(folder)}`);
      const json = await res.json();
      if (json.data) setArchiveDetail(json.data);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Archive className="h-5 w-5 text-zinc-400" />
        <h2 className="text-xl font-semibold">归档</h2>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-zinc-500 text-sm">加载归档中...</p>
      )}

      {/* Empty state */}
      {!loading && archives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Archive className="h-16 w-16 text-cyan-500 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400 mb-2">
            暂无归档记录
          </h3>
          <p className="text-sm text-zinc-600 max-w-md">
            每次 Ralph 运行完成后，历史记录会自动归档到这里。
            <br />
            归档存储在{" "}
            <code className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
              scripts/ralph/archive/
            </code>{" "}
            目录中。
          </p>
        </div>
      )}

      {/* Archive list */}
      {!loading && archives.length > 0 && (
        <div className="space-y-2">
          {archives.map((archive) => {
            const isExpanded = expandedFolder === archive.folder;

            return (
              <div key={archive.folder}>
                {/* Archive item header */}
                <button
                  onClick={() => handleToggle(archive.folder)}
                  className="relative w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-200 text-left group"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] rounded-l-lg bg-gradient-to-b from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />
                  )}
                  <Archive className="h-4 w-4 text-zinc-500 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {archive.featureName}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] border-zinc-700 text-zinc-500"
                      >
                        {archive.date}
                      </Badge>
                    </div>
                  </div>

                  {/* Completion stats */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {archive.totalStories > 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-xs text-zinc-400">
                            {archive.completedStories}/{archive.totalStories}
                          </span>
                        </div>
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                            style={{
                              width: `${
                                (archive.completedStories /
                                  archive.totalStories) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">暂无故事</span>
                    )}
                  </div>
                </button>

                {/* Expanded detail with CSS grid animation */}
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{
                    gridTemplateRows: isExpanded ? "1fr" : "0fr",
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="mt-2 ml-7 space-y-4">
                    {isExpanded && detailLoading && (
                      <p className="text-zinc-500 text-sm py-4">
                        加载归档详情...
                      </p>
                    )}

                    {isExpanded && !detailLoading && archiveDetail && (
                      <>
                        {/* Project info */}
                        {archiveDetail.prd && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-medium text-zinc-300">
                                {archiveDetail.prd.project}
                              </h3>
                              {archiveDetail.prd.branchName && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] border-zinc-700 text-zinc-500"
                                >
                                  {archiveDetail.prd.branchName}
                                </Badge>
                              )}
                            </div>
                            {archiveDetail.prd.description && (
                              <p className="text-xs text-zinc-500">
                                {archiveDetail.prd.description}
                              </p>
                            )}

                            {/* Read-only Flow */}
                            <div
                              style={{
                                height: calcFlowHeight(
                                  archiveDetail.prd.userStories.length
                                ),
                              }}
                            >
                              <StoryFlow
                                stories={archiveDetail.prd.userStories}
                                projectName={archiveDetail.prd.project}
                                description={archiveDetail.prd.description || ""}
                                branchName={archiveDetail.prd.branchName}
                                ralphStatus="idle"
                                readOnly
                              />
                            </div>
                          </div>
                        )}

                        {/* Progress log */}
                        {archiveDetail.progress && (
                          <ArchiveProgressLog
                            progress={archiveDetail.progress}
                          />
                        )}

                        {/* Nothing found */}
                        {!archiveDetail.prd && !archiveDetail.progress && (
                          <p className="text-zinc-600 text-sm py-4">
                            此归档中未找到 prd.json 或 progress.txt。
                          </p>
                        )}
                      </>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArchiveProgressLog({ progress }: { progress: ProgressLogData }) {
  if (
    progress.records.length === 0 &&
    progress.codebasePatterns.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-zinc-500" />
        <h4 className="text-sm font-medium text-zinc-400">进度日志</h4>
      </div>

      {/* Codebase Patterns */}
      {progress.codebasePatterns.length > 0 && (
        <Card className="bg-violet-950/40 border-violet-800/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-violet-300">
                代码库模式
              </span>
            </div>
            <ul className="space-y-1">
              {progress.codebasePatterns.map((p, i) => (
                <li
                  key={i}
                  className="text-xs text-violet-200/80 flex items-start gap-2"
                >
                  <span className="text-violet-500 mt-0.5 shrink-0">
                    &bull;
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Records */}
      {progress.records.length > 0 && (
        <div className="relative ml-4">
          <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-800" />
          {progress.records.map((record, i) => (
            <div key={i} className="relative pl-6 pb-4">
              <div className="absolute left-0 top-2 -translate-x-1/2 h-2 w-2 rounded-full bg-zinc-600 border-2 border-zinc-900" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-zinc-500">
                    {record.date}
                  </span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-zinc-700 text-zinc-400"
                  >
                    {record.storyId}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {record.summary}
                </p>
                {record.filesChanged.length > 0 && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <FileCode2 className="h-3 w-3 text-zinc-600 mt-0.5 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {record.filesChanged.map((f, fi) => (
                        <Badge
                          key={fi}
                          variant="secondary"
                          className="font-mono text-[9px] bg-zinc-800 text-zinc-500 px-1 py-0"
                        >
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {record.learnings.length > 0 && (
                  <Card className="bg-violet-950/30 border-violet-900/40">
                    <CardContent className="p-2">
                      <ul className="space-y-0.5">
                        {record.learnings.map((l, li) => (
                          <li
                            key={li}
                            className="text-[10px] text-violet-200/60 flex items-start gap-1.5"
                          >
                            <span className="text-violet-500 mt-0.5">
                              &bull;
                            </span>
                            <span>{l}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
