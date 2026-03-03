import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { platform } from 'node:os';
import chalk from 'chalk';
import { readConfig, RepoConfig } from '../lib/global-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const brand = chalk.hex('#6366f1');

function getScriptsDir(): string {
  return resolve(__dirname, '../../scripts/ralph');
}

interface RepoEntry {
  name: string;
  config: RepoConfig;
}

interface RepoResult {
  name: string;
  success: boolean;
  exitCode: number | null;
}

function findRalphScript(repoPath: string): string | null {
  // Check for repo-local ralph.sh first
  const repoLocal = resolve(repoPath, 'scripts/ralph/ralph.sh');
  if (existsSync(repoLocal)) {
    return repoLocal;
  }
  // Fall back to the global ralph.sh in this project
  const globalScript = resolve(getScriptsDir(), 'ralph.sh');
  if (existsSync(globalScript)) {
    return globalScript;
  }
  return null;
}

function spawnRepoProcess(
  entry: RepoEntry,
  globalConfig: ReturnType<typeof readConfig>,
): Promise<RepoResult> {
  return new Promise((resolvePromise) => {
    const { name, config: repoConfig } = entry;
    const repoPath = repoConfig.path;

    if (!existsSync(repoPath)) {
      console.log(chalk.red(`  [${name}] ✗ 仓库路径不存在: ${repoPath}`));
      resolvePromise({ name, success: false, exitCode: null });
      return;
    }

    const scriptPath = findRalphScript(repoPath);
    if (!scriptPath) {
      console.log(chalk.red(`  [${name}] ✗ 未找到 ralph.sh`));
      resolvePromise({ name, success: false, exitCode: null });
      return;
    }

    const args: string[] = [scriptPath];

    // Pass global config defaults
    if (globalConfig.defaultTool) {
      args.push('--tool', globalConfig.defaultTool);
    }
    if (globalConfig.timeoutMinutes) {
      args.push('--timeout', String(globalConfig.timeoutMinutes));
    }
    if (globalConfig.webhookUrl) {
      args.push('--webhook', globalConfig.webhookUrl);
    }
    if (globalConfig.defaultMaxIterations) {
      args.push(String(globalConfig.defaultMaxIterations));
    }

    const isWin = platform() === 'win32';
    const shell = isWin ? globalConfig.gitBashPath || 'bash' : '/bin/bash';

    console.log(brand(`  [${name}] ▶ 启动 (type=${repoConfig.type}, priority=${repoConfig.priority})`));

    const child: ChildProcess = spawn(shell, args, {
      cwd: repoPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) console.log(chalk.gray(`  [${name}] ${line}`));
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line) console.log(chalk.yellow(`  [${name}] ${line}`));
      }
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green(`  [${name}] ✓ 完成`));
      } else {
        console.log(chalk.red(`  [${name}] ✗ 退出码: ${code}`));
      }
      resolvePromise({ name, success: code === 0, exitCode: code });
    });

    child.on('error', (err) => {
      console.log(chalk.red(`  [${name}] ✗ 启动失败: ${err.message}`));
      resolvePromise({ name, success: false, exitCode: null });
    });
  });
}

export async function runRunAll(options: { repo?: string; type?: string } = {}): Promise<void> {
  const config = readConfig();

  // Find active project
  const activeProject = config.projects.find(p => p.name === config.activeProject);
  if (!activeProject) {
    console.log(chalk.yellow('⚠ 没有活跃项目，请先运行 ralph init 或 ralph add-project'));
    process.exit(1);
  }

  const repos = activeProject.repositories;

  // Fallback: single-repo project without repositories config
  if (!repos || Object.keys(repos).length === 0) {
    console.log(chalk.gray('  项目没有 repositories 配置，回退到单仓库模式'));
    const scriptPath = findRalphScript(activeProject.path);
    if (!scriptPath) {
      console.log(chalk.red('✗ 未找到 ralph.sh'));
      process.exit(1);
    }

    const isWin = platform() === 'win32';
    const shell = isWin ? config.gitBashPath || 'bash' : '/bin/bash';
    const args: string[] = [scriptPath];
    if (config.defaultTool) args.push('--tool', config.defaultTool);
    if (config.timeoutMinutes) args.push('--timeout', String(config.timeoutMinutes));
    if (config.webhookUrl) args.push('--webhook', config.webhookUrl);
    if (config.defaultMaxIterations) args.push(String(config.defaultMaxIterations));

    console.log(brand('  ▶ 启动单仓库 ralph 循环'));
    const child = spawn(shell, args, {
      cwd: activeProject.path,
      env: { ...process.env },
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      process.exit(code ?? 1);
    });
    return;
  }

  // Build list of repos to run, applying filters
  let entries: RepoEntry[] = Object.entries(repos).map(([name, repoConfig]) => ({ name, config: repoConfig }));

  if (options.repo) {
    entries = entries.filter(e => e.name === options.repo);
    if (entries.length === 0) {
      console.log(chalk.red(`✗ 未找到名为 "${options.repo}" 的仓库`));
      console.log(chalk.gray(`  可用仓库: ${Object.keys(repos).join(', ')}`));
      process.exit(1);
    }
  }

  if (options.type) {
    entries = entries.filter(e => e.config.type === options.type);
    if (entries.length === 0) {
      console.log(chalk.red(`✗ 没有类型为 "${options.type}" 的仓库`));
      const types = [...new Set(Object.values(repos).map(r => r.type))];
      console.log(chalk.gray(`  可用类型: ${types.join(', ')}`));
      process.exit(1);
    }
  }

  if (entries.length === 0) {
    console.log(chalk.yellow('⚠ 筛选后没有匹配的仓库'));
    process.exit(1);
  }

  // Group by priority
  const priorityGroups = new Map<number, RepoEntry[]>();
  for (const entry of entries) {
    const p = entry.config.priority;
    if (!priorityGroups.has(p)) {
      priorityGroups.set(p, []);
    }
    priorityGroups.get(p)!.push(entry);
  }

  // Sort priorities ascending (lower priority number runs first)
  const sortedPriorities = [...priorityGroups.keys()].sort((a, b) => a - b);

  console.log('');
  console.log(brand('  🚀 Ralph Run-All 多仓库编排'));
  console.log(chalk.gray(`  项目: ${activeProject.name}`));
  console.log(chalk.gray(`  仓库: ${entries.map(e => e.name).join(', ')}`));
  console.log(chalk.gray(`  阶段: ${sortedPriorities.length} 个优先级阶段`));
  console.log('');

  const allResults: RepoResult[] = [];

  for (const priority of sortedPriorities) {
    const group = priorityGroups.get(priority)!;
    console.log(brand(`  ── 阶段 ${priority} (${group.map(e => e.name).join(', ')}) ──`));
    console.log('');

    // Run all repos in this priority group in parallel
    const results = await Promise.all(
      group.map(entry => spawnRepoProcess(entry, config))
    );
    allResults.push(...results);

    console.log('');
  }

  // Summary report
  console.log(brand('  ── 汇总报告 ──'));
  console.log('');
  for (const result of allResults) {
    const status = result.success
      ? chalk.green('✓ 成功')
      : chalk.red('✗ 失败');
    console.log(`  ${status}  ${result.name}`);
  }

  const failedCount = allResults.filter(r => !r.success).length;
  console.log('');
  if (failedCount > 0) {
    console.log(chalk.yellow(`  ⚠ ${failedCount}/${allResults.length} 个仓库执行失败`));
  } else {
    console.log(chalk.green(`  ✓ 全部 ${allResults.length} 个仓库执行成功`));
  }
  console.log('');
}
