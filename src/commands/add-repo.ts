import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readConfig, writeConfig } from '../lib/global-config.js';
import type { RepoConfig } from '../lib/global-config.js';

const BRAND = chalk.hex('#6366f1');
const OK = chalk.green;
const ERR = chalk.red;
const WARN = chalk.yellow;

const REPO_TYPES: RepoConfig['type'][] = ['docs', 'backend', 'frontend', 'app', 'other'];

export async function runAddRepo(): Promise<void> {
  console.log(BRAND('\n📦 添加仓库\n'));

  const config = readConfig();

  // Check for active project
  if (!config.activeProject) {
    console.log(ERR('❌ 没有活跃项目。请先运行 ralph init 或 ralph add-project。\n'));
    return;
  }

  const project = config.projects.find((p) => p.name === config.activeProject);
  if (!project) {
    console.log(ERR(`❌ 找不到活跃项目 "${config.activeProject}"。请检查配置。\n`));
    return;
  }

  console.log(chalk.gray(`当前项目：${project.name}\n`));

  const existingRepos = project.repositories ?? {};

  // Repo name
  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: 'input',
      name: 'name',
      message: '仓库名称：',
      validate: (input: string) => {
        if (!input.trim()) return '仓库名称不能为空';
        if (input.trim() in existingRepos) {
          return `仓库 "${input.trim()}" 已存在`;
        }
        return true;
      },
    },
  ]);

  // Repo path
  const { repoPath } = await inquirer.prompt<{ repoPath: string }>([
    {
      type: 'input',
      name: 'repoPath',
      message: '仓库绝对路径：',
      validate: (input: string) => {
        if (!input.trim()) return '路径不能为空';
        const resolved = resolve(input.trim());
        if (!existsSync(resolved)) return `路径不存在：${resolved}`;
        return true;
      },
    },
  ]);

  // Repo type
  const { repoType } = await inquirer.prompt<{ repoType: RepoConfig['type'] }>([
    {
      type: 'list',
      name: 'repoType',
      message: '仓库类型：',
      choices: REPO_TYPES,
    },
  ]);

  // Priority
  const defaultPriority = repoType === 'docs' ? 0 : 1;
  const { priority } = await inquirer.prompt<{ priority: number }>([
    {
      type: 'number',
      name: 'priority',
      message: '执行优先级（数字越小越先执行）：',
      default: defaultPriority,
    },
  ]);

  // Checks (optional)
  const { checksInput } = await inquirer.prompt<{ checksInput: string }>([
    {
      type: 'input',
      name: 'checksInput',
      message: '质量检查命令（可选，逗号分隔）：',
      default: '',
    },
  ]);

  const resolvedPath = resolve(repoPath.trim());
  const repoConfig: RepoConfig = {
    path: resolvedPath,
    type: repoType,
    priority: priority,
  };

  const trimmedChecks = checksInput.trim();
  if (trimmedChecks) {
    repoConfig.checks = trimmedChecks.split(',').map((c) => c.trim()).filter(Boolean);
  }

  // Add to project
  if (!project.repositories) {
    project.repositories = {};
  }
  project.repositories[name.trim()] = repoConfig;

  writeConfig(config);

  console.log(OK(`\n✅ 仓库 "${name.trim()}" 已添加到项目 "${project.name}"`));
  console.log(chalk.gray(`   路径：${resolvedPath}`));
  console.log(chalk.gray(`   类型：${repoType}`));
  console.log(chalk.gray(`   优先级：${priority}`));
  if (repoConfig.checks) {
    console.log(chalk.gray(`   检查命令：${repoConfig.checks.join(', ')}`));
  }
  console.log('');
}
