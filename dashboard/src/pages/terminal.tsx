import { useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import {
  Terminal,
  Loader2,
  Clock,
  Hash,
  Wifi,
  WifiOff,
  Trash2,
  PauseCircle,
  PlayCircle,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useWebSocket, useRalphStatus } from "@/hooks/use-websocket";
import { useDashboardStore } from "@/lib/store";
import type { TerminalHandle } from "@/components/terminal-view";

const TerminalView = lazy(() => import("@/components/terminal-view"));

function TerminalFallback() {
  return (
    <div className="flex items-center justify-center h-full bg-[#1a1a2e]">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
    </div>
  );
}

const WELCOME_MESSAGE = [
  "\x1b[1;35m  ____       _       _     \x1b[0m",
  "\x1b[1;35m |  _ \\ __ _| |_ __ | |__  \x1b[0m",
  "\x1b[1;35m | |_) / _` | | '_ \\| '_ \\ \x1b[0m",
  "\x1b[1;35m |  _ < (_| | | |_) | | | |\x1b[0m",
  "\x1b[1;35m |_| \\_\\__,_|_| .__/|_| |_|\x1b[0m",
  "\x1b[1;35m              |_|          \x1b[0m",
  "",
  "\x1b[1;37m  自主 AI 代理循环\x1b[0m",
  "",
  "\x1b[90m  Ralph 当前未运行。\x1b[0m",
  "\x1b[90m  在 Claude Code 中使用 /ralph-start 启动循环。\x1b[0m",
  "",
].join("\r\n");

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-zinc-500",
  running: "bg-cyan-500 animate-pulse",
  completed: "bg-blue-500",
  error: "bg-red-500",
};

const STATUS_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  idle: "secondary",
  running: "default",
  completed: "default",
  error: "destructive",
};

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "00:00";
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

interface IterationBuffer {
  output: string;
  startTime: string;
}

export default function TerminalPage() {
  const liveTermHandleRef = useRef<TerminalHandle | null>(null);
  const historyTermHandleRef = useRef<TerminalHandle | null>(null);
  const { status, iteration, totalIterations, startedAt } = useRalphStatus();
  const wsState = useDashboardStore((s) => s.wsState);
  const prd = useDashboardStore((s) => s.prd);
  const ws = useWebSocket();

  const [elapsed, setElapsed] = useState("00:00");

  // Iteration history state
  const [activeTab, setActiveTab] = useState("live");
  const [iterationBuffers, setIterationBuffers] = useState<
    Map<number, IterationBuffer>
  >(new Map());
  const [currentIterationNum, setCurrentIterationNum] = useState(0);

  // Toolbar state
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);

  // Live output buffer for current iteration and full session
  const liveOutputRef = useRef("");
  const currentIterOutputRef = useRef("");

  // Completion summary
  const [completionSummary, setCompletionSummary] = useState<{
    storiesCompleted: number;
    totalElapsed: string;
  } | null>(null);
  const sessionStartRef = useRef<string | null>(null);

  // Update elapsed timer every second when running
  useEffect(() => {
    if (status !== "running" || !startedAt) {
      setElapsed("00:00");
      return;
    }

    sessionStartRef.current = startedAt;
    setElapsed(formatElapsed(startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startedAt]);

  // Clear completion summary and buffers when Ralph starts
  useEffect(() => {
    if (status === "running") {
      setCompletionSummary(null);
    }
  }, [status]);

  // Show completion summary when Ralph finishes
  useEffect(() => {
    if (
      (status === "completed" || status === "idle") &&
      sessionStartRef.current &&
      currentIterationNum > 0
    ) {
      const totalElapsed = formatElapsed(sessionStartRef.current);
      const storiesCompleted = prd?.userStories?.filter((s) => s.passes).length ?? 0;
      setCompletionSummary({ storiesCompleted, totalElapsed });
      sessionStartRef.current = null;
    }
  }, [status, currentIterationNum, prd]);

  // Subscribe to ralph:output and pipe to live xterm + buffer
  useEffect(() => {
    const unsub = ws.subscribe(
      "ralph:output",
      (payload: Record<string, unknown>) => {
        const text = payload.text as string;
        const converted = text.replace(/\r?\n/g, "\r\n");

        // Buffer output
        liveOutputRef.current += converted;
        currentIterOutputRef.current += converted;

        // Write to live terminal if on live tab and auto-scroll is on
        if (liveTermHandleRef.current) {
          liveTermHandleRef.current.write(converted);
        }
      }
    );

    return unsub;
  }, [ws]);

  // Subscribe to ralph:iteration events for tab creation
  useEffect(() => {
    const unsub = ws.subscribe(
      "ralph:iteration",
      (payload: Record<string, unknown>) => {
        const current = payload.current as number;
        const prev = currentIterationNum;

        // Save previous iteration's buffer
        if (prev > 0 && currentIterOutputRef.current) {
          setIterationBuffers((buffers) => {
            const newBuffers = new Map(buffers);
            newBuffers.set(prev, {
              output: currentIterOutputRef.current,
              startTime: new Date().toISOString(),
            });
            return newBuffers;
          });
        }

        // Reset current iteration buffer for the new iteration
        currentIterOutputRef.current = "";
        setCurrentIterationNum(current);
      }
    );

    return unsub;
  }, [ws, currentIterationNum]);

  // When Ralph stops, save the final iteration buffer
  useEffect(() => {
    if (
      status !== "running" &&
      currentIterationNum > 0 &&
      currentIterOutputRef.current
    ) {
      const iterNum = currentIterationNum;
      const output = currentIterOutputRef.current;
      setIterationBuffers((buffers) => {
        const newBuffers = new Map(buffers);
        newBuffers.set(iterNum, {
          output,
          startTime: new Date().toISOString(),
        });
        return newBuffers;
      });
    }
  }, [status, currentIterationNum]);

  // When switching to a history tab, load that iteration's output into the history terminal
  useEffect(() => {
    if (activeTab === "live") return;
    const iterNum = parseInt(activeTab.replace("iter-", ""), 10);
    const buffer = iterationBuffers.get(iterNum);
    if (buffer && historyTermHandleRef.current) {
      historyTermHandleRef.current.clear();
      historyTermHandleRef.current.write(buffer.output);
    }
  }, [activeTab, iterationBuffers]);

  const handleLiveTerminalReady = useCallback((handle: TerminalHandle) => {
    liveTermHandleRef.current = handle;
  }, []);

  const handleHistoryTerminalReady = useCallback(
    (handle: TerminalHandle) => {
      historyTermHandleRef.current = handle;
      // Immediately load buffer for current history tab
      if (activeTab !== "live") {
        const iterNum = parseInt(activeTab.replace("iter-", ""), 10);
        const buffer = iterationBuffers.get(iterNum);
        if (buffer) {
          handle.clear();
          handle.write(buffer.output);
        }
      }
    },
    [activeTab, iterationBuffers]
  );

  // Handle keyboard input -> send to Ralph stdin via WebSocket
  const handleInput = useCallback(
    (data: string) => {
      if (status === "running") {
        ws.send("ralph:stdin", { input: data });
      }
    },
    [ws, status]
  );

  const handleClear = () => {
    if (activeTab === "live") {
      liveTermHandleRef.current?.clear();
    }
  };

  const handleToggleAutoScroll = () => {
    setAutoScroll((prev) => {
      autoScrollRef.current = !prev;
      return !prev;
    });
  };

  const handleDownload = () => {
    let content: string;
    let filename: string;

    if (activeTab === "live") {
      content = liveOutputRef.current;
      filename = `ralph-live-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.log`;
    } else {
      const iterNum = parseInt(activeTab.replace("iter-", ""), 10);
      const buffer = iterationBuffers.get(iterNum);
      content = buffer?.output ?? "";
      filename = `ralph-iteration-${iterNum}.log`;
    }

    // Strip ANSI codes for clean log file
    const cleanContent = content
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\r\n/g, "\n");

    const blob = new Blob([cleanContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build iteration tab list
  const iterationTabs: number[] = [];
  const maxIter = Math.max(currentIterationNum, ...iterationBuffers.keys(), 0);
  for (let i = 1; i <= maxIter; i++) {
    iterationTabs.push(i);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar - Row 1: Title + Status info */}
      <div className="flex flex-col gap-0 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-zinc-400" />
            <h1 className="text-lg font-semibold text-zinc-100">终端</h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* WebSocket connection indicator */}
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              {wsState === "connected" ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500" />
              )}
            </div>

            {/* Status badge */}
            <Badge
              variant={STATUS_BADGE_VARIANTS[status] ?? "secondary"}
              className={`gap-1.5 ${status === "running" ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent" : ""}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] ?? "bg-zinc-500"}`}
              />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>

            {/* Iteration */}
            {status === "running" && (
              <Badge variant="outline" className="gap-1">
                <Hash className="h-3 w-3" />
                {iteration}/{totalIterations}
              </Badge>
            )}

            {/* Elapsed time */}
            {status === "running" && (
              <Badge variant="outline" className="gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {elapsed}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Completion summary */}
      {completionSummary && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-gradient-to-r from-cyan-950/30 to-blue-950/30">
          <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          <span className="text-sm text-cyan-300">
            Ralph 已完成：{completionSummary.storiesCompleted} 个故事通过，总耗时 {completionSummary.totalElapsed}
          </span>
        </div>
      )}

      {/* Tab bar + Toolbar + Terminal */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 min-h-0 flex flex-col gap-0"
      >
        <div className="relative flex items-center border-b border-zinc-800 bg-zinc-950/30">
          <TabsList
            variant="line"
            className="px-2 h-9"
          >
            <TabsTrigger value="live" className="text-xs px-3 gap-1">
              {status === "running" && (
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              )}
              实时
            </TabsTrigger>
            {iterationTabs.map((num) => (
              <TabsTrigger
                key={num}
                value={`iter-${num}`}
                className="text-xs px-3"
              >
                迭代 {num}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Toolbar buttons */}
          <div className="flex items-center gap-1 ml-auto pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
              title="清除输出"
              disabled={activeTab !== "live"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleAutoScroll}
              className={`h-7 w-7 p-0 ${autoScroll ? "text-green-500 hover:text-green-400" : "text-zinc-500 hover:text-zinc-300"}`}
              title={
                autoScroll ? "暂停自动滚动" : "恢复自动滚动"
              }
            >
              {autoScroll ? (
                <PauseCircle className="h-3.5 w-3.5" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
              title="下载日志"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Iteration progress bar */}
          {status === "running" && totalIterations > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${(iteration / totalIterations) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Terminal content areas */}
        <TabsContent value="live" className="flex-1 min-h-0 mt-0">
          <Suspense fallback={<TerminalFallback />}>
            <TerminalView
              onInput={handleInput}
              onReady={handleLiveTerminalReady}
              welcomeMessage={
                status !== "running" && !liveOutputRef.current
                  ? WELCOME_MESSAGE
                  : undefined
              }
            />
          </Suspense>
        </TabsContent>

        {iterationTabs.map((num) => (
          <TabsContent
            key={num}
            value={`iter-${num}`}
            className="flex-1 min-h-0 mt-0"
          >
            <Suspense fallback={<TerminalFallback />}>
              <TerminalView
                readOnly
                onReady={handleHistoryTerminalReady}
              />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
