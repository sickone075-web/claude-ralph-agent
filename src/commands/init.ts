import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readConfig, writeConfig, getConfigPath, type RalphConfig } from '../lib/global-config.js';
import type { RepoConfig } from '../lib/global-config.js';

const BRAND = chalk.hex('#6366f1');
const WARN = chalk.yellow;
const ERR = chalk.red;
const OK = chalk.green;
const DIM = chalk.dim;

const RALPH_LOGO = `
  ██████╗  █████╗ ██╗     ██████╗ ██╗  ██╗
  ██╔══██╗██╔══██╗██║     ██╔══██╗██║  ██║
  ██████╔╝███████║██║     ██████╔╝███████║
  ██╔══██╗██╔══██║██║     ██╔═══╝ ██╔══██║
  ██║  ██║██║  ██║███████╗██║     ██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝
`;

const EXTERNAL_SKILLS = [
  {
    name: 'superpowers',
    key: 'superpowers@superpowers-marketplace',
    description: '工作流增强（brainstorming、code-review、debugging 等）',
    installHint: '在 Claude Code 中运行: /install-plugin superpowers-marketplace',
    required: false,
  },
  {
    name: 'dev-browser',
    keyPattern: 'dev-browser',
    description: '浏览器测试（UI 故事验证必需）',
    installHint: '在 Claude Code 中搜索并安装 dev-browser 插件',
    required: false,
  },
] as const;

const GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\devTools\\Git\\bin\\bash.exe',
];

function getPackageVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function stepCheckExistingConfig(): Promise<'overwrite' | 'keep' | 'exit'> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return 'overwrite';

  const { action } = await inquirer.prompt<{ action: 'overwrite' | 'keep' | 'exit' }>([
    {
      type: 'list',
      name: 'action',
      message: '检测到已有配置文件 (~/.ralph/config.json)，如何处理？',
      choices: [
        { name: '覆盖 — 重新配置所有选项', value: 'overwrite' },
        { name: '保留 — 跳过已配置项目，仅补充缺失项', value: 'keep' },
        { name: '退出', value: 'exit' },
      ],
    },
  ]);
  return action;
}

async function stepWelcome(version: string): Promise<boolean> {
  console.log(BRAND(RALPH_LOGO));
  console.log(BRAND.bold(`  Ralph v${version}`));
  console.log(DIM('  Ralph 管理工具 — 安装引导、启动控制台、管理项目。'));
  console.log(DIM('  AI 对话请在 Claude Code 中进行。\n'));

  console.log(chalk.bold('  📋 权限声明'));
  console.log('  Ralph 运行过程中需要以下权限：\n');
  console.log('    • Claude Code 执行权限 — 自动运行 AI 编码会话');
  console.log('    • Git 操作 — 创建分支、提交代码');
  console.log('    • 文件读写 — 读写项目文件和配置');
  console.log('    • 网络请求 — 发送飞书通知（可选）\n');

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: '是否了解并同意上述权限？',
      default: true,
    },
  ]);
  return confirmed;
}

function checkNodeVersion(): boolean {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) {
    console.log(OK(`  ✓ Node.js v${process.versions.node}`));
    return true;
  }
  console.log(ERR(`  ✗ Node.js v${process.versions.node} — 需要 >= 18`));
  return false;
}

function checkClaudeCli(): boolean {
  const cmd = platform() === 'win32' ? 'where claude' : 'which claude';
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(OK('  ✓ Claude CLI 可用'));
    return true;
  } catch {
    console.log(WARN('  ⚠ Claude CLI 未检测到'));
    console.log(DIM('    安装指引: https://docs.anthropic.com/en/docs/claude-code'));
    console.log(DIM('    可稍后安装，继续初始化...\n'));
    return false;
  }
}

async function stepEnvironment(): Promise<boolean> {
  console.log(chalk.bold('\n  🔍 环境检测\n'));
  const nodeOk = checkNodeVersion();
  if (!nodeOk) {
    console.log(ERR('\n  Node.js 版本不满足要求，请升级到 18 或更高版本。'));
    return false;
  }
  checkClaudeCli();
  return true;
}

async function stepGitBash(config: RalphConfig): Promise<RalphConfig> {
  if (platform() !== 'win32') return config;

  console.log(chalk.bold('\n  🐚 Windows Git Bash 配置\n'));

  // Auto-detect
  let detectedPath = '';
  for (const p of GIT_BASH_PATHS) {
    if (existsSync(p)) {
      detectedPath = p;
      break;
    }
  }

  if (detectedPath) {
    console.log(OK(`  检测到 Git Bash: ${detectedPath}`));
    const { useDetected } = await inquirer.prompt<{ useDetected: boolean }>([
      {
        type: 'confirm',
        name: 'useDetected',
        message: `使用此路径？(${detectedPath})`,
        default: true,
      },
    ]);
    if (useDetected) {
      config.gitBashPath = detectedPath;
      return config;
    }
  } else {
    console.log(WARN('  未自动检测到 Git Bash'));
  }

  // Manual input
  const { manualPath } = await inquirer.prompt<{ manualPath: string }>([
    {
      type: 'input',
      name: 'manualPath',
      message: '请输入 Git Bash (bash.exe) 的完整路径：',
      validate: (input: string) => {
        if (!input.trim()) return '路径不能为空';
        if (!existsSync(input.trim())) return `文件不存在: ${input.trim()}`;
        return true;
      },
    },
  ]);
  config.gitBashPath = manualPath.trim();
  return config;
}

async function stepFeishu(config: RalphConfig): Promise<RalphConfig> {
  console.log(chalk.bold('\n  📨 飞书 Webhook 配置（可选）\n'));

  const { wantFeishu } = await inquirer.prompt<{ wantFeishu: boolean }>([
    {
      type: 'confirm',
      name: 'wantFeishu',
      message: '是否配置飞书 Webhook 通知？',
      default: false,
    },
  ]);

  if (!wantFeishu) {
    console.log(DIM('  跳过飞书配置\n'));
    return config;
  }

  console.log(DIM('  创建飞书 Webhook 步骤：'));
  console.log(DIM('    1. 打开飞书群 → 设置 → 群机器人'));
  console.log(DIM('    2. 添加"自定义机器人"'));
  console.log(DIM('    3. 复制 Webhook URL\n'));

  let success = false;
  while (!success) {
    const { url } = await inquirer.prompt<{ url: string }>([
      {
        type: 'input',
        name: 'url',
        message: '粘贴飞书 Webhook URL：',
        validate: (input: string) => {
          if (!input.trim()) return 'URL 不能为空';
          if (!input.trim().startsWith('https://')) return 'URL 必须以 https:// 开头';
          return true;
        },
      },
    ]);

    const trimmedUrl = url.trim();
    console.log(DIM('  正在发送测试消息...'));

    try {
      const res = await fetch(trimmedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: '🤖 Ralph 测试通知' },
              template: 'blue',
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'plain_text',
                  content: 'Ralph 飞书通知配置成功！这是一条测试消息。',
                },
              },
            ],
          },
        }),
      });

      if (res.ok) {
        const body = await res.json() as Record<string, unknown>;
        if (body.code === 0 || body.StatusCode === 0) {
          console.log(OK('  ✅ 测试消息发送成功！请在飞书群中查看。\n'));
          config.webhookUrl = trimmedUrl;
          success = true;
        } else {
          console.log(ERR(`  ✗ 飞书返回错误: ${JSON.stringify(body)}`));
        }
      } else {
        console.log(ERR(`  ✗ HTTP 错误: ${res.status}`));
      }
    } catch (err) {
      console.log(ERR(`  ✗ 请求失败: ${(err as Error).message}`));
    }

    if (!success) {
      const { retry } = await inquirer.prompt<{ retry: boolean }>([
        {
          type: 'confirm',
          name: 'retry',
          message: '是否重试？',
          default: true,
        },
      ]);
      if (!retry) {
        console.log(DIM('  跳过飞书配置\n'));
        return config;
      }
    }
  }

  return config;
}

async function stepRunParams(config: RalphConfig, action: 'overwrite' | 'keep' | 'exit'): Promise<RalphConfig> {
  console.log(chalk.bold('\n  ⚙️  运行参数配置\n'));

  const { tool } = await inquirer.prompt<{ tool: string }>([
    {
      type: 'list',
      name: 'tool',
      message: 'AI 工具选择',
      choices: [
        { name: 'claude（推荐）', value: 'claude' },
        { name: 'amp', value: 'amp' },
      ],
      default: action === 'keep' ? config.defaultTool : 'claude',
    },
  ]);

  const { maxIterations } = await inquirer.prompt<{ maxIterations: number }>([
    {
      type: 'number',
      name: 'maxIterations',
      message: '最大迭代次数',
      default: action === 'keep' ? config.defaultMaxIterations : 10,
    },
  ]);

  const { timeout } = await inquirer.prompt<{ timeout: number }>([
    {
      type: 'number',
      name: 'timeout',
      message: '超时时间（分钟）',
      default: action === 'keep' ? config.timeoutMinutes : 30,
    },
  ]);

  const { maxFailures } = await inquirer.prompt<{ maxFailures: number }>([
    {
      type: 'number',
      name: 'maxFailures',
      message: '连续失败上限',
      default: action === 'keep' ? config.maxConsecutiveFailures : 5,
    },
  ]);

  config.defaultTool = tool;
  config.defaultMaxIterations = maxIterations;
  config.timeoutMinutes = timeout;
  config.maxConsecutiveFailures = maxFailures;

  return config;
}

async function stepFirstProject(config: RalphConfig, action: 'overwrite' | 'keep' | 'exit'): Promise<RalphConfig> {
  // Skip if keeping config and already has projects
  if (action === 'keep' && config.projects.length > 0) {
    console.log(DIM(`\n  已有 ${config.projects.length} 个项目，跳过项目添加\n`));
    return config;
  }

  console.log(chalk.bold('\n  📁 项目配置\n'));

  const { wantProject } = await inquirer.prompt<{ wantProject: boolean }>([
    {
      type: 'confirm',
      name: 'wantProject',
      message: '是否立即添加一个项目？',
      default: true,
    },
  ]);

  if (!wantProject) {
    console.log(DIM('  可稍后使用 ralph add-project 添加\n'));
    return config;
  }

  const { name } = await inquirer.prompt<{ name: string }>([
    {
      type: 'input',
      name: 'name',
      message: '项目名称：',
      validate: (input: string) => {
        if (!input.trim()) return '名称不能为空';
        if (config.projects.some(p => p.name === input.trim())) return '该名称已存在';
        return true;
      },
    },
  ]);

  const { projectPath } = await inquirer.prompt<{ projectPath: string }>([
    {
      type: 'input',
      name: 'projectPath',
      message: '项目绝对路径：',
      validate: (input: string) => {
        if (!input.trim()) return '路径不能为空';
        if (!existsSync(input.trim())) return `路径不存在: ${input.trim()}`;
        return true;
      },
    },
  ]);

  const trimmedName = name.trim();
  const trimmedPath = projectPath.trim();

  config.projects.push({ name: trimmedName, path: trimmedPath });
  config.activeProject = trimmedName;
  console.log(OK(`  ✓ 项目 "${trimmedName}" 已添加并设为活跃项目`));

  return config;
}

function getPackageRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // dist/commands/init.js → package root (2 levels up)
  return resolve(__dirname, '../..');
}

const REPO_TYPES: RepoConfig['type'][] = ['docs', 'backend', 'frontend', 'app', 'other'];

async function stepRepositories(config: RalphConfig): Promise<RalphConfig> {
  // Only run if a project was just added or already exists
  const project = config.projects.find(p => p.name === config.activeProject);
  if (!project) return config;

  console.log(chalk.bold('\n  📦 多仓库配置\n'));

  const { isMultiRepo } = await inquirer.prompt<{ isMultiRepo: boolean }>([
    {
      type: 'confirm',
      name: 'isMultiRepo',
      message: '是否为多仓库项目？（前后端分离、文档仓库等）',
      default: false,
    },
  ]);

  if (!isMultiRepo) {
    console.log(DIM('  跳过多仓库配置\n'));
    return config;
  }

  if (!project.repositories) {
    project.repositories = {};
  }

  let addMore = true;
  while (addMore) {
    const existingRepos = project.repositories!;

    const { name } = await inquirer.prompt<{ name: string }>([
      {
        type: 'input',
        name: 'name',
        message: '仓库名称：',
        validate: (input: string) => {
          if (!input.trim()) return '仓库名称不能为空';
          if (input.trim() in existingRepos) return `仓库 "${input.trim()}" 已存在`;
          return true;
        },
      },
    ]);

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

    const { repoType } = await inquirer.prompt<{ repoType: RepoConfig['type'] }>([
      {
        type: 'list',
        name: 'repoType',
        message: '仓库类型：',
        choices: REPO_TYPES,
      },
    ]);

    const defaultPriority = repoType === 'docs' ? 0 : 1;
    const { priority } = await inquirer.prompt<{ priority: number }>([
      {
        type: 'number',
        name: 'priority',
        message: '执行优先级（数字越小越先执行）：',
        default: defaultPriority,
      },
    ]);

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
      repoConfig.checks = trimmedChecks.split(',').map(c => c.trim()).filter(Boolean);
    }

    project.repositories![name.trim()] = repoConfig;
    console.log(OK(`  ✓ 仓库 "${name.trim()}" 已添加`));

    const { continueAdding } = await inquirer.prompt<{ continueAdding: boolean }>([
      {
        type: 'confirm',
        name: 'continueAdding',
        message: '继续添加仓库？',
        default: false,
      },
    ]);
    addMore = continueAdding;
  }

  return config;
}

function stepPluginGuide(): void {
  console.log(chalk.bold('\n  🔌 Claude Code Skills 注册\n'));

  const pkgRoot = getPackageRoot();
  const pluginDir = resolve(pkgRoot, '.claude-plugin');
  const skillsDir = resolve(pkgRoot, 'skills');

  if (!existsSync(skillsDir)) {
    console.log(WARN('  ⚠ Skills 目录未找到，请检查安装是否完整'));
    console.log(DIM(`    预期路径: ${skillsDir}\n`));
    return;
  }

  console.log(OK('  ✓ Skills 目录已就绪'));
  console.log(DIM(`    路径: ${skillsDir}\n`));

  // Try auto-install via claude CLI
  let installed = false;
  try {
    execSync(`claude plugins install "${pluginDir}"`, { stdio: 'pipe' });
    console.log(OK('  ✓ Skills 已自动注册到 Claude Code'));
    installed = true;
  } catch {
    // claude plugins install may not be the right command, or CLI unavailable
  }

  if (!installed) {
    try {
      execSync(`claude install "${pluginDir}"`, { stdio: 'pipe' });
      console.log(OK('  ✓ Skills 已自动注册到 Claude Code'));
      installed = true;
    } catch {
      // Fall through to manual instructions
    }
  }

  if (!installed) {
    console.log(WARN('  ⚠ 未能自动注册 Skills，请手动安装：'));
    console.log(DIM(`    claude install "${pluginDir}"`));
    console.log(DIM('    或在 Claude Code Marketplace 中搜索 "ralph-zh-skills"\n'));
  }

  console.log('  可用的 skill：');
  console.log(BRAND('    /prd') + '   — 生成产品需求文档（含头脑风暴和需求讨论）');
  console.log(BRAND('    /ralph') + ' — 将 PRD 转换为 prd.json 任务格式');
  console.log('');
}

function checkInstalledPlugins(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  try {
    const settingsPath = resolve(homedir(), '.claude', 'settings.json');
    if (!existsSync(settingsPath)) return result;
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const enabled = settings.enabledPlugins ?? {};
    const keys = Object.keys(enabled);

    for (const skill of EXTERNAL_SKILLS) {
      if ('key' in skill && skill.key) {
        result[skill.name] = keys.some(k => k === skill.key && enabled[k]);
      } else if ('keyPattern' in skill && skill.keyPattern) {
        result[skill.name] = keys.some(k => k.includes(skill.keyPattern) && enabled[k]);
      }
    }
  } catch {
    // settings.json 不存在或解析失败，视为全部未安装
  }
  return result;
}

function stepExternalSkills(): void {
  console.log(chalk.bold('\n  🧩 外部 Skills 检测\n'));

  const installed = checkInstalledPlugins();
  let allInstalled = true;

  for (const skill of EXTERNAL_SKILLS) {
    if (installed[skill.name]) {
      console.log(OK(`  ✓ ${skill.name} — ${skill.description}`));
    } else {
      allInstalled = false;
      console.log(WARN(`  ⚠ ${skill.name} 未检测到 — ${skill.description}`));
      console.log(DIM(`    ${skill.installHint}`));
    }
  }

  if (allInstalled) {
    console.log(OK('\n  所有推荐 Skills 已就绪'));
  } else {
    console.log(DIM('\n  缺少的 Skills 不影响基础功能，但部分高级功能（如 UI 浏览器验证）将不可用'));
    console.log(DIM('  可稍后在 Claude Code 中安装'));
  }
  console.log('');
}

function stepCompletion(config: RalphConfig): void {
  console.log(chalk.bold('\n  🎉 初始化完成！\n'));
  console.log('  配置摘要：');
  console.log(`  ├─ AI 工具：        ${config.defaultTool}`);
  console.log(`  ├─ 最大迭代次数：   ${config.defaultMaxIterations}`);
  console.log(`  ├─ 超时时间：       ${config.timeoutMinutes} 分钟`);
  console.log(`  ├─ 连续失败上限：   ${config.maxConsecutiveFailures}`);
  console.log(`  ├─ 飞书通知：       ${config.webhookUrl ? OK('已配置') : DIM('未配置')}`);
  console.log(`  ├─ Git Bash 路径：  ${config.gitBashPath || DIM('未设置')}`);
  console.log(`  └─ 项目：           ${config.projects.length > 0 ? config.projects.map(p => p.name).join(', ') : DIM('无')}`);

  // Show repositories for active project
  const activeProject = config.projects.find(p => p.name === config.activeProject);
  if (activeProject?.repositories && Object.keys(activeProject.repositories).length > 0) {
    console.log('');
    console.log('  仓库列表：');
    const repos = Object.entries(activeProject.repositories);
    repos.forEach(([repoName, repo], i) => {
      const prefix = i < repos.length - 1 ? '├─' : '└─';
      console.log(`  ${prefix} ${repoName} (${repo.type}) — ${repo.path}`);
    });
  }
  console.log('');
  console.log(`  配置已保存到 ${DIM(getConfigPath())}`);
  console.log(`  执行 ${BRAND('ralph dashboard')} 启动 Web 控制台`);
  console.log('');
}

export async function runInit(): Promise<void> {
  const version = getPackageVersion();

  // Step 0: Check existing config
  const action = await stepCheckExistingConfig();
  if (action === 'exit') {
    console.log(DIM('\n  已退出初始化。\n'));
    return;
  }

  // Read existing config (readConfig merges with defaults, so both cases work)
  let config: RalphConfig = readConfig();

  // Step 1: Welcome & permission
  const confirmed = await stepWelcome(version);
  if (!confirmed) {
    console.log(DIM('\n  已退出初始化。\n'));
    return;
  }

  // Step 2: Environment detection
  const envOk = await stepEnvironment();
  if (!envOk) {
    return;
  }

  // Step 3: Git Bash path (Windows only)
  config = await stepGitBash(config);

  // Step 4: Feishu webhook (optional)
  config = await stepFeishu(config);

  // Step 5: Run parameters
  config = await stepRunParams(config, action);

  // Step 6: First project
  config = await stepFirstProject(config, action);

  // Step 7: Repositories (multi-repo)
  config = await stepRepositories(config);

  // Step 8: Claude Code plugin guidance
  stepPluginGuide();

  // Step 8: External skills detection
  stepExternalSkills();

  // Step 9: Completion — save & summary
  writeConfig(config);
  stepCompletion(config);
}
