import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ProjectConfig {
  name: string;
  path: string;
}

export interface RalphConfig {
  defaultTool: string;
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

const DEFAULT_CONFIG: RalphConfig = {
  defaultTool: 'claude',
  defaultMaxIterations: 10,
  timeoutMinutes: 30,
  maxConsecutiveFailures: 5,
  retryIntervalSeconds: 3600,
  webhookUrl: '',
  gitBashPath: '',
  port: 3000,
  wsPort: 3001,
  terminalFontSize: 14,
  autoOpenBrowser: true,
  activeProject: '',
  projects: [],
};

export function getConfigDir(): string {
  return join(homedir(), '.ralph');
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function readConfig(): RalphConfig {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (!existsSync(configPath)) {
    writeConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<RalphConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function writeConfig(config: RalphConfig): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const tmpFile = join(configDir, `.config-${randomUUID()}.tmp`);
  writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf-8');
  renameSync(tmpFile, configPath);
}
