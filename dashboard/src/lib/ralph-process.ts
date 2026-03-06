import { spawn, ChildProcess, execSync } from "child_process";
import fs from "fs";
import { getRalphScriptPath, getActiveProjectPaths } from "./config";

export type RalphStatus = "idle" | "running" | "completed" | "error";

interface RalphState {
  status: RalphStatus;
  iteration: number;
  startedAt: string | null;
  process: ChildProcess | null;
  listeners: Array<(event: string, data: unknown) => void>;
}

const state: RalphState = {
  status: "idle",
  iteration: 0,
  startedAt: null,
  process: null,
  listeners: [],
};

const ITERATION_REGEX = /Ralph Iteration (\d+) of (\d+)/;

export function getPidFilePath(): string | null {
  const projectPaths = getActiveProjectPaths();
  if (!projectPaths) {
    return null;
  }
  return projectPaths.pidPath;
}

export function detectRunningFromPid(): { running: boolean; pid: number | null } {
  const pidPath = getPidFilePath();
  if (!pidPath) {
    return { running: false, pid: null };
  }

  try {
    if (!fs.existsSync(pidPath)) {
      return { running: false, pid: null };
    }

    const pidStr = fs.readFileSync(pidPath, "utf-8").trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) {
      return { running: false, pid: null };
    }

    // process.kill(pid, 0) throws if process doesn't exist
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    return { running: false, pid: null };
  }
}

export function getRalphStatus() {
  // If we have an in-memory process, use that state
  if (state.process !== null) {
    return {
      status: state.status,
      iteration: state.iteration,
      startedAt: state.startedAt,
    };
  }

  // Fallback: check PID file for externally started ralph
  if (state.status !== "running") {
    const pidCheck = detectRunningFromPid();
    if (pidCheck.running) {
      return {
        status: "running" as RalphStatus,
        iteration: state.iteration,
        startedAt: state.startedAt,
      };
    }
  }

  return {
    status: state.status,
    iteration: state.iteration,
    startedAt: state.startedAt,
  };
}

export function isRunning(): boolean {
  if (state.status === "running" && state.process !== null) {
    return true;
  }
  // Also check PID file for externally started processes
  return detectRunningFromPid().running;
}

export function startRalph(params: {
  tool: "claude" | "amp";
  maxIterations: number;
  timeout?: number;
  webhook?: string;
}): void {
  if (isRunning()) {
    throw new Error("Ralph is already running");
  }

  const scriptPath = getRalphScriptPath();
  const projectPaths = getActiveProjectPaths();
  const cwd = projectPaths?.projectPath ?? process.cwd();

  const args = ["--tool", params.tool];
  if (params.timeout && params.timeout > 0) {
    args.push("--timeout", String(params.timeout));
  }
  if (params.webhook) {
    args.push("--webhook", params.webhook);
  }
  args.push(String(params.maxIterations));

  const isWindows = process.platform === "win32";
  let child: ChildProcess;

  // Set RALPH_PROJECT_DIR so ralph.sh knows the project root
  const env = {
    ...process.env,
    RALPH_PROJECT_DIR: cwd,
  };

  if (isWindows) {
    child = spawn("bash", [scriptPath, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env,
    });
  } else {
    child = spawn(scriptPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env,
    });
  }

  state.process = child;
  state.status = "running";
  state.iteration = 0;
  state.startedAt = new Date().toISOString();

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    const match = text.match(ITERATION_REGEX);
    if (match) {
      state.iteration = parseInt(match[1], 10);
      emit("ralph:iteration", {
        current: parseInt(match[1], 10),
        total: parseInt(match[2], 10),
      });
    }
    emit("ralph:output", { stream: "stdout", text });
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    emit("ralph:output", { stream: "stderr", text });
  });

  child.on("close", (code) => {
    state.process = null;
    state.status = code === 0 ? "completed" : "error";
    emit("ralph:status", { status: state.status, code });
  });

  child.on("error", (err) => {
    state.process = null;
    state.status = "error";
    emit("ralph:status", { status: "error", error: err.message });
  });

  emit("ralph:status", { status: "running" });
}

export function stopRalph(): void {
  if (!state.process) {
    return;
  }

  const pid = state.process.pid;
  if (!pid) {
    return;
  }

  const isWindows = process.platform === "win32";
  if (isWindows) {
    try {
      execSync(`taskkill /pid ${pid} /t /f`, { stdio: "ignore" });
    } catch {
      // Process may already be gone
    }
  } else {
    state.process.kill("SIGTERM");
  }
}

export function sendStdin(input: string): void {
  if (!state.process?.stdin?.writable) {
    throw new Error("Ralph process is not running or stdin is not writable");
  }
  state.process.stdin.write(input);
}

export function onEvent(listener: (event: string, data: unknown) => void) {
  state.listeners.push(listener);
  return () => {
    state.listeners = state.listeners.filter((l) => l !== listener);
  };
}

function emit(event: string, data: unknown) {
  for (const listener of state.listeners) {
    listener(event, data);
  }
}
