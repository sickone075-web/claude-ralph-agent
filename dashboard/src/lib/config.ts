import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";

export interface ProjectConfig {
  name: string;
  path: string;
}

export interface DashboardConfig {
  defaultTool: "claude" | "amp";
  defaultMaxIterations: number;
  timeoutMinutes: number;
  maxConsecutiveFailures: number;
  retryIntervalSeconds: number;
  webhookUrl: string;
  gitBashPath: string;
  port: number;
  wsPort: number;
  terminalFontSize: number;
  autoOpenBrowser: boolean;
  activeProject: string;
  projects: ProjectConfig[];
}

export interface ActiveProjectPaths {
  prdPath: string;
  progressPath: string;
  projectPath: string;
  archivePath: string;
  ralphDir: string;      // $PROJECT/.ralph
  stateDir: string;      // ~/.ralph/projects/<name>
  pidPath: string;
  logPath: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".ralph");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const DEFAULTS: DashboardConfig = {
  defaultTool: "claude",
  defaultMaxIterations: 10,
  timeoutMinutes: 30,
  maxConsecutiveFailures: 5,
  retryIntervalSeconds: 3600,
  webhookUrl: "",
  gitBashPath: "",
  port: 3000,
  wsPort: 3001,
  terminalFontSize: 14,
  autoOpenBrowser: true,
  activeProject: "",
  projects: [],
};

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfig(): DashboardConfig {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      writeConfig(DEFAULTS);
      return { ...DEFAULTS };
    }

    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(config: Partial<DashboardConfig>): DashboardConfig {
  const current = getConfig();
  const merged: DashboardConfig = {
    ...current,
    ...config,
  };

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const tmpFile = path.join(CONFIG_DIR, `.config-${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmpFile, JSON.stringify(merged, null, 2), "utf-8");
  fs.renameSync(tmpFile, CONFIG_FILE);
  return merged;
}

export function getRalphScriptPath(): string {
  if (process.env.RALPH_SCRIPTS_DIR) {
    return path.join(process.env.RALPH_SCRIPTS_DIR, "ralph.sh");
  }
  // Primary: global ~/.ralph/ralph.sh
  const globalScript = path.join(CONFIG_DIR, "ralph.sh");
  if (fs.existsSync(globalScript)) {
    return globalScript;
  }
  // Fallback: package source (dev mode)
  const fromDashboard = path.resolve(process.cwd(), "..", "scripts", "ralph", "ralph.sh");
  if (fs.existsSync(fromDashboard)) {
    return fromDashboard;
  }
  return path.resolve(__dirname, "..", "..", "..", "scripts", "ralph", "ralph.sh");
}

export function getActiveProjectPaths(): ActiveProjectPaths | null {
  const config = getConfig();

  if (!config.activeProject || config.projects.length === 0) {
    return null;
  }

  const project = config.projects.find((p) => p.name === config.activeProject);
  if (!project) {
    return null;
  }

  // Project-level: $PROJECT/.ralph/
  const ralphDir = path.join(project.path, ".ralph");

  // Runtime state: ~/.ralph/projects/<name>/
  const stateDir = path.join(CONFIG_DIR, "projects", config.activeProject);

  return {
    prdPath: path.join(ralphDir, "prd.json"),
    progressPath: path.join(ralphDir, "progress.txt"),
    projectPath: project.path,
    archivePath: path.join(ralphDir, "archive"),
    ralphDir,
    stateDir,
    pidPath: path.join(stateDir, ".ralph-pid"),
    logPath: path.join(stateDir, "ralph.log"),
  };
}
