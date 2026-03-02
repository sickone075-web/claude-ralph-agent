import { WebSocketServer, WebSocket } from "ws";
import { watch } from "chokidar";
import path from "path";
import { onEvent, sendStdin } from "../src/lib/ralph-process";
import { getConfig } from "../src/lib/config";

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

// Watch prd.json and progress.txt for changes
const config = getConfig();
const filesToWatch = [config.prdPath, config.progressPath];

let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const watcher = watch(filesToWatch, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

watcher.on("change", (filePath: string) => {
  const normalized = path.resolve(filePath);
  const eventType = normalized === path.resolve(config.prdPath)
    ? "prd:updated"
    : "progress:updated";

  // Debounce 500ms per file
  if (debounceTimers[normalized]) {
    clearTimeout(debounceTimers[normalized]);
  }

  debounceTimers[normalized] = setTimeout(() => {
    broadcast(eventType, { file: normalized });
    delete debounceTimers[normalized];
  }, 500);
});

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
