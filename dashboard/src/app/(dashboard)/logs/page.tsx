"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ScrollText,
  GitCommitHorizontal,
  Search,
  BookOpen,
  FileCode2,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/use-websocket";
import type { ProgressRecord, GitCommit, ProgressLogData } from "@/lib/types";
import Link from "next/link";

export default function LogsPage() {
  const [progressData, setProgressData] = useState<ProgressLogData>({
    codebasePatterns: [],
    records: [],
  });
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [search, setSearch] = useState("");
  const [fadeInIds, setFadeInIds] = useState<Set<string>>(new Set());
  const ws = useWebSocket();

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/logs/progress");
      const json = await res.json();
      if (json.data) {
        const prev = progressData.records.length;
        setProgressData(json.data);
        // Mark new entries for fade-in
        if (prev > 0 && json.data.records.length > prev) {
          const newIds = new Set<string>(
            json.data.records
              .slice(0, json.data.records.length - prev)
              .map((r: ProgressRecord) => r.storyId + r.date)
          );
          setFadeInIds(newIds);
          setTimeout(() => setFadeInIds(new Set()), 1000);
        }
      }
    } catch {
      // ignore
    }
  }, [progressData.records.length]);

  const fetchCommits = useCallback(async () => {
    try {
      const res = await fetch("/api/logs/git");
      const json = await res.json();
      if (json.data) setCommits(json.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProgress();
    fetchCommits();
  }, []);

  // WebSocket: re-fetch on progress:updated
  useEffect(() => {
    const unsub = ws.subscribe("progress:updated", () => {
      fetchProgress();
      fetchCommits();
    });
    return unsub;
  }, [ws, fetchProgress, fetchCommits]);

  const searchLower = search.toLowerCase();

  const filteredRecords = progressData.records.filter(
    (r) =>
      !search ||
      r.storyId.toLowerCase().includes(searchLower) ||
      r.summary.toLowerCase().includes(searchLower) ||
      r.date.toLowerCase().includes(searchLower) ||
      r.filesChanged.some((f) => f.toLowerCase().includes(searchLower)) ||
      r.learnings.some((l) => l.toLowerCase().includes(searchLower))
  );

  const filteredCommits = commits.filter(
    (c) =>
      !search ||
      c.hash.toLowerCase().includes(searchLower) ||
      c.message.toLowerCase().includes(searchLower) ||
      c.author.toLowerCase().includes(searchLower) ||
      c.date.toLowerCase().includes(searchLower)
  );

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold">迭代日志</h2>
        </div>
      </div>

      <Tabs defaultValue="progress" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-4 flex-wrap">
          <TabsList variant="line">
            <TabsTrigger value="progress">
              <BookOpen className="h-4 w-4 mr-1" />
              Progress Log
            </TabsTrigger>
            <TabsTrigger value="git">
              <GitCommitHorizontal className="h-4 w-4 mr-1" />
              Git 历史
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="搜索日志..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 bg-zinc-900 border-zinc-800 text-sm focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Progress Log Tab */}
        <TabsContent value="progress" className="mt-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Codebase Patterns pinned at top */}
            {progressData.codebasePatterns.length > 0 && (
              <Card className="gradient-border bg-violet-950/40 border-violet-800/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-violet-300">
                      代码库模式
                    </h3>
                  </div>
                  <ul className="space-y-1.5">
                    {progressData.codebasePatterns.map((pattern, i) => (
                      <li
                        key={i}
                        className="text-sm text-violet-200/80 flex items-start gap-2"
                      >
                        <span className="text-violet-500 mt-1 shrink-0">
                          &bull;
                        </span>
                        <span>{pattern}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <ScrollText className="h-12 w-12 mx-auto mb-3 text-cyan-500" />
                <p className="text-zinc-500 text-sm">
                  {search ? "没有匹配的日志条目。" : "暂无进度记录，Ralph 开始运行后将在此显示迭代日志。"}
                </p>
              </div>
            ) : (
              <div className="relative ml-4">
                {/* Timeline line */}
                <div className="absolute left-0 top-2 bottom-2 w-px" style={{ background: 'linear-gradient(to bottom, #06B6D4, #3B82F6, transparent)' }} />

                {filteredRecords.map((record, i) => {
                  const id = record.storyId + record.date;
                  const isFadeIn = fadeInIds.has(id);

                  return (
                    <div
                      key={i}
                      className={`relative pl-6 pb-6 transition-opacity duration-500 ${
                        isFadeIn ? "animate-fade-in" : ""
                      }`}
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-cyan-500 border-2 border-zinc-900" style={{ boxShadow: '0 0 6px rgba(6, 182, 212, 0.4)' }} />

                      <div className="space-y-2">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-zinc-500">
                            {record.date}
                          </span>
                          <Link href="/stories">
                            <Badge
                              variant="outline"
                              className="font-mono text-xs border-zinc-700 text-zinc-300 hover:border-zinc-500 cursor-pointer"
                            >
                              {record.storyId}
                              <ExternalLink className="h-3 w-3 ml-0.5" />
                            </Badge>
                          </Link>
                        </div>

                        {/* Summary */}
                        <p className="text-sm text-zinc-300 leading-relaxed">
                          {record.summary}
                        </p>

                        {/* Files Changed */}
                        {record.filesChanged.length > 0 && (
                          <div className="flex items-start gap-2 flex-wrap">
                            <FileCode2 className="h-3.5 w-3.5 text-zinc-500 mt-0.5 shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {record.filesChanged.map((f, fi) => (
                                <Badge
                                  key={fi}
                                  variant="secondary"
                                  className="font-mono text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0"
                                >
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Learnings */}
                        {record.learnings.length > 0 && (
                          <Card className="bg-violet-950/30 border-violet-900/40 transition-shadow duration-200 hover:shadow-[0_0_12px_rgba(139,92,246,0.15)]">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Lightbulb className="h-3 w-3 text-violet-400" />
                                <span className="text-xs font-medium text-violet-400">
                                  学习记录
                                </span>
                              </div>
                              <ul className="space-y-1">
                                {record.learnings.map((l, li) => (
                                  <li
                                    key={li}
                                    className="text-xs text-violet-200/70 flex items-start gap-1.5"
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
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Git History Tab */}
        <TabsContent value="git" className="mt-4 overflow-y-auto">
          {filteredCommits.length === 0 ? (
            <p className="text-zinc-500 text-sm py-8 text-center">
              {search ? "没有匹配的提交记录。" : "未找到 Git 提交记录。"}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredCommits.map((commit, i) => {
                const isRalph = commit.message.startsWith("feat:");
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-900/60 transition-colors group"
                  >
                    <code className="text-xs font-mono text-amber-500/80 shrink-0 w-16">
                      {commit.hash}
                    </code>
                    <span className="text-sm text-zinc-300 flex-1 truncate">
                      {commit.message}
                    </span>
                    {isRalph && (
                      <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] px-1.5 py-0 shrink-0">
                        Ralph
                      </Badge>
                    )}
                    <span className="text-xs text-zinc-600 shrink-0">
                      {commit.author}
                    </span>
                    <span className="text-xs text-zinc-600 shrink-0">
                      {formatDate(commit.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
