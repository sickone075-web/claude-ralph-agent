import { WebSocketServer, WebSocket } from "ws";
import { watch, FSWatcher } from "chokidar";
import path from "path";
import { onEvent, sendStdin } from "../src/lib/ralph-process";
import { getActiveProjectPaths, getActiveProjectRepos } from "../src/lib/config";

const PORT = 3001;

const wss = new WebSocketServer({ port: PORT });

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

// Subscribe to Ralph process events and broadcast to all WebSocket clients
onEvent((event: string, data: unknown) => {
  broadcast(event, data as object);
});

// Watch prd.json, progress.txt, and .ralph-pid for changes based on active project
let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
let currentWatcher: FSWatcher | null = null;
// Maps resolved file paths to { eventType, repo? } for broadcast
let fileEventMap: Record<string, { eventType: string; repo?: string }> = {};

function setupFileWatcher() {
  // Clean up previous watcher
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }
  fileEventMap = {};

  const repos = getActiveProjectRepos();

  if (repos && repos.length > 0) {
    // Multi-repo mode: watch all repos' prd.json, progress.txt, and .ralph-pid
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

      // Debounce 500ms per file
      if (debounceTimers[normalized]) {
        clearTimeout(debounceTimers[normalized]);
      }

      debounceTimers[normalized] = setTimeout(() => {
        broadcast(eventType, { file: normalized, ...(repo ? { repo } : {}) });
        delete debounceTimers[normalized];
      }, 500);
    });

    console.log("[WS] Multi-repo mode: watching files for repos:", repos.map(r => r.name).join(", "));
  } else {
    // Single-repo fallback
    const projectPaths = getActiveProjectPaths();
    if (!projectPaths) {
      console.log("[WS] No active project configured, file watching disabled");
      return;
    }

    const filesToWatch = [projectPaths.prdPath, projectPaths.progressPath];
    fileEventMap[path.resolve(projectPaths.prdPath)] = { eventType: "prd:updated" };
    fileEventMap[path.resolve(projectPaths.progressPath)] = { eventType: "progress:updated" };

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

      // Debounce 500ms per file
      if (debounceTimers[normalized]) {
        clearTimeout(debounceTimers[normalized]);
      }

      debounceTimers[normalized] = setTimeout(() => {
        broadcast(eventType, { file: normalized });
        delete debounceTimers[normalized];
      }, 500);
    });

    console.log("[WS] Watching files:", filesToWatch);
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

console.log(`[WS] WebSocket server running on ws://localhost:${PORT}`);
