import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { watch, type FSWatcher } from "chokidar";
import path from "path";
import { onEvent, sendStdin, getPidFilePath, detectRunningFromPid } from "../src/lib/ralph-process";
import { getActiveProjectPaths, getActiveProjectRepos } from "../src/lib/config";
import { initLogCache, addLogLine, getCurrentStoryId, setCurrentStoryId, detectStoryIdFromOutput, clearLogCache } from "./log-cache";

// Routes
import { ralphRouter } from "./routes/ralph";
import { prdRouter } from "./routes/prd";
import { configRouter } from "./routes/config";
import { projectsRouter } from "./routes/projects";
import { logsRouter } from "./routes/logs";
import { archivesRouter } from "./routes/archives";
import { reposRouter } from "./routes/repos";

const PORT = parseInt(process.env.PORT || "3000", 10);

const app = express();
app.use(express.json());

// --- API Routes ---
app.use("/api/ralph", ralphRouter);
app.use("/api/prd", prdRouter);
app.use("/api/config", configRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/logs", logsRouter);
app.use("/api/archives", archivesRouter);
app.use("/api/repos", reposRouter);

// --- Static SPA files ---
const clientDistDir = path.resolve(__dirname, "../dist/client");
app.use(express.static(clientDistDir));

// SPA fallback: serve index.html for any non-API, non-WS route
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDistDir, "index.html"));
});

// --- HTTP Server ---
const server = createServer(app);

// --- WebSocket Server (same port, /ws path) ---
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host}`).pathname;
  if (pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

function broadcast(type: string, payload: object) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Initialize log cache
initLogCache();

// Subscribe to Ralph process events and broadcast to all WebSocket clients
onEvent((event: string, data: unknown) => {
  if (event === "ralph:output") {
    const payload = data as { stream: string; text: string };
    const text = payload.text;

    // Try to detect story ID changes from output
    const detectedId = detectStoryIdFromOutput(text);
    if (detectedId) {
      setCurrentStoryId(detectedId);
    }

    const storyId = getCurrentStoryId();

    // Cache the log line
    addLogLine(text, storyId);

    // Broadcast with storyId attached
    broadcast(event, { ...payload, storyId });
    return;
  }

  if (event === "ralph:status") {
    const payload = data as { status: string };
    // Clear log cache when ralph starts fresh
    if (payload.status === "running") {
      clearLogCache();
      initLogCache();
    }
  }

  broadcast(event, data as object);
});

// --- File Watcher (from ws.ts) ---
let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
let currentWatcher: FSWatcher | null = null;
let fileEventMap: Record<string, { eventType: string; repo?: string }> = {};

function setupFileWatcher() {
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }
  fileEventMap = {};

  const repos = getActiveProjectRepos();

  if (repos && repos.length > 0) {
    const filesToWatch: string[] = [];

    for (const repo of repos) {
      const progressPath = path.join(path.dirname(repo.prdPath), "progress.txt");

      fileEventMap[path.resolve(repo.prdPath)] = { eventType: "prd:updated", repo: repo.name };
      fileEventMap[path.resolve(progressPath)] = { eventType: "progress:updated", repo: repo.name };
      fileEventMap[path.resolve(repo.pidPath)] = { eventType: "pid:updated", repo: repo.name };

      filesToWatch.push(repo.prdPath, progressPath, repo.pidPath);
    }

    currentWatcher = watch(filesToWatch, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    currentWatcher.on("change", (filePath: string) => {
      const normalized = path.resolve(filePath);
      const mapping = fileEventMap[normalized];
      const eventType = mapping?.eventType ?? "file:updated";
      const repo = mapping?.repo;

      if (debounceTimers[normalized]) {
        clearTimeout(debounceTimers[normalized]);
      }

      debounceTimers[normalized] = setTimeout(() => {
        broadcast(eventType, { file: normalized, ...(repo ? { repo } : {}) });
        delete debounceTimers[normalized];
      }, 500);
    });

    console.log("[Server] Multi-repo mode: watching files for repos:", repos.map(r => r.name).join(", "));
  } else {
    const projectPaths = getActiveProjectPaths();
    if (!projectPaths) {
      console.log("[Server] No active project configured, file watching disabled");
      return;
    }

    const filesToWatch = [projectPaths.prdPath, projectPaths.progressPath];
    fileEventMap[path.resolve(projectPaths.prdPath)] = { eventType: "prd:updated" };
    fileEventMap[path.resolve(projectPaths.progressPath)] = { eventType: "progress:updated" };

    // Also watch the PID file for external start/stop detection
    const pidPath = getPidFilePath();
    if (pidPath) {
      filesToWatch.push(pidPath);
    }

    currentWatcher = watch(filesToWatch, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    currentWatcher.on("change", (filePath: string) => {
      const normalized = path.resolve(filePath);

      // PID file change → broadcast ralph:status
      if (pidPath && normalized === path.resolve(pidPath)) {
        const pidCheck = detectRunningFromPid();
        broadcast("ralph:status", {
          status: pidCheck.running ? "running" : "idle",
        });
        return;
      }

      const mapping = fileEventMap[normalized];
      const eventType = mapping?.eventType ?? "file:updated";

      if (debounceTimers[normalized]) {
        clearTimeout(debounceTimers[normalized]);
      }

      debounceTimers[normalized] = setTimeout(() => {
        broadcast(eventType, { file: normalized });
        delete debounceTimers[normalized];
      }, 500);
    });

    // PID file created → ralph started externally
    currentWatcher.on("add", (filePath: string) => {
      if (pidPath && path.resolve(filePath) === path.resolve(pidPath)) {
        const pidCheck = detectRunningFromPid();
        if (pidCheck.running) {
          broadcast("ralph:status", { status: "running" });
        }
      }
    });

    // PID file deleted → ralph stopped
    currentWatcher.on("unlink", (filePath: string) => {
      if (pidPath && path.resolve(filePath) === path.resolve(pidPath)) {
        broadcast("ralph:status", { status: "idle" });
      }
    });

    console.log("[Server] Watching files:", filesToWatch);
  }
}

setupFileWatcher();

// Handle incoming WebSocket connections
wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] Client connected");

  ws.on("message", (raw: Buffer) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "ralph:stdin" && typeof message.payload?.input === "string") {
        try {
          sendStdin(message.payload.input);
        } catch (err) {
          ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: (err as Error).message },
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
  });
});

// --- Start ---
server.listen(PORT, () => {
  console.log(`[Server] Ralph Dashboard running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}/ws`);
});
