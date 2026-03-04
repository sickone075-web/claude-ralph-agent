"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Pause, Play, ScrollText } from "lucide-react";
import type { Story } from "@/lib/types";
import { useWsSubscribe } from "@/components/websocket-provider";

// Log line color coding based on content
function getLogLineColor(line: string): string {
  // Command lines (starts with $ or >)
  if (/^\s*[\$>]/.test(line)) return "#B1ADA1";
  // Story pickup (contains story ID pattern)
  if (/US-\d+/.test(line)) return "#C15F3C";
  // Code additions (starts with +)
  if (/^\+/.test(line)) return "#22C55E";
  // Warnings
  if (/warn(ing)?/i.test(line)) return "#F59E0B";
  // Default info
  return "#666666";
}

interface StoryLogTabProps {
  story: Story;
}

export function StoryLogTab({ story }: StoryLogTabProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoscroll, setAutoscroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const subscribe = useWsSubscribe();

  const isRunning =
    story.status === "running" || (!story.status && !story.passes);

  // Fetch historical logs
  useEffect(() => {
    setLoading(true);
    setLogs([]);
    fetch(`/api/logs/${story.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setLogs(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [story.id]);

  // Subscribe to real-time logs via WebSocket
  useEffect(() => {
    if (!isRunning) return;

    const unsub = subscribe(
      "ralph:output",
      (payload: Record<string, unknown>) => {
        const payloadStoryId = payload.storyId as string | null;
        if (payloadStoryId === story.id) {
          const text = payload.text as string;
          if (text) {
            setLogs((prev) => [...prev, text]);
          }
        }
      }
    );

    return unsub;
  }, [subscribe, story.id, isRunning]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoscroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoscroll]);

  const toggleAutoscroll = useCallback(() => {
    setAutoscroll((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div
          className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#E0DDD5", borderTopColor: "transparent" }}
        />
        <p className="mt-3 text-sm" style={{ color: "#B1ADA1" }}>
          加载日志中...
        </p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <ScrollText className="h-10 w-10 mb-3" style={{ color: "#B1ADA1" }} />
        <p className="text-sm" style={{ color: "#B1ADA1" }}>
          暂无执行日志
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 py-2 mb-2">
        <span
          className="text-[11px]"
          style={{
            color: "#999999",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          执行日志 — {story.id}
        </span>
        <button
          onClick={toggleAutoscroll}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors"
          style={{
            border: "1px solid #E0DDD5",
            borderRadius: "6px",
            color: autoscroll ? "#C15F3C" : "#999999",
            backgroundColor: autoscroll ? "#FEF0E8" : "transparent",
          }}
        >
          {autoscroll ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {autoscroll ? "暂停滚动" : "自动滚动"}
        </button>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-lg p-4"
        style={{
          backgroundColor: "#FAFAF7",
          maxHeight: "calc(100vh - 320px)",
        }}
      >
        <pre
          className="text-[11px] leading-[1.6] whitespace-pre-wrap break-words m-0"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {logs.map((line, i) => (
            <div key={i} style={{ color: getLogLineColor(line) }}>
              {line}
            </div>
          ))}
        </pre>

        {/* Live indicator */}
        {isRunning && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "#C15F3C" }}
            />
            <span
              className="inline-block w-2 h-4 animate-pulse"
              style={{
                backgroundColor: "#C15F3C",
                opacity: 0.6,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
