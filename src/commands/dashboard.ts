import { spawn, ChildProcess, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import chalk from 'chalk';
import open from 'open';
import { readConfig, getConfigPath } from '../lib/global-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const brand = chalk.hex('#6366f1');

function getDashboardDir(): string {
  // From dist/commands/dashboard.js -> project root -> dashboard/
  return resolve(__dirname, '../../dashboard');
}

function getScriptsDir(): string {
  return resolve(__dirname, '../../scripts');
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

export async function runDashboard(options: { open?: boolean }): Promise<void> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    console.log(chalk.yellow('⚠ 未找到配置文件，请先运行 ralph init'));
    console.log(chalk.gray(`  配置路径: ${configPath}`));
    process.exit(1);
  }

  const config = readConfig();
  const port = config.port;
  const wsPort = config.wsPort;
  const dashboardDir = getDashboardDir();
  const scriptsDir = getScriptsDir();

  // Verify dashboard directory exists
  if (!existsSync(dashboardDir)) {
    console.log(chalk.red('✗ dashboard 目录不存在'));
    console.log(chalk.gray(`  路径: ${dashboardDir}`));
    process.exit(1);
  }

  // Check port availability
  const portInUse = await isPortInUse(port);
  if (portInUse) {
    console.log(chalk.red(`✗ 端口 ${port} 已被占用`));
    console.log(chalk.gray('  请关闭占用端口的进程后重试'));
    process.exit(1);
  }

  const wsPortInUse = await isPortInUse(wsPort);
  if (wsPortInUse) {
    console.log(chalk.red(`✗ WebSocket 端口 ${wsPort} 已被占用`));
    console.log(chalk.gray('  请关闭占用端口的进程后重试'));
    process.exit(1);
  }

  console.log('');
  console.log(brand('  🚀 Ralph 控制台启动中...'));
  console.log('');

  const children: ChildProcess[] = [];

  // Determine how to start the Next.js server
  // standalone server.js may be at .next/standalone/server.js or .next/standalone/dashboard/server.js
  // depending on whether Next.js detects a workspace root above dashboard/
  const standalonePathDirect = resolve(dashboardDir, '.next/standalone/server.js');
  const standalonePathNested = resolve(dashboardDir, '.next/standalone/dashboard/server.js');
  const standalonePath = existsSync(standalonePathDirect) ? standalonePathDirect
    : existsSync(standalonePathNested) ? standalonePathNested
    : standalonePathDirect;
  const env = {
    ...process.env,
    PORT: String(port),
    RALPH_SCRIPTS_DIR: scriptsDir,
  };

  let nextChild: ChildProcess;
  if (existsSync(standalonePath)) {
    // Production standalone mode
    nextChild = spawn('node', [standalonePath], {
      cwd: dashboardDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    // Fallback: use npx next start (requires build)
    const nextBinDir = resolve(dashboardDir, 'node_modules/.bin');
    const isWin = platform() === 'win32';
    const nextBin = isWin
      ? resolve(nextBinDir, 'next.cmd')
      : resolve(nextBinDir, 'next');

    if (!existsSync(resolve(dashboardDir, '.next'))) {
      console.log(chalk.yellow('⚠ 未找到 dashboard 构建产物，正在构建...'));
      execSync('npm run build', { cwd: dashboardDir, stdio: 'inherit' });
      console.log(chalk.green('✓ 构建完成'));
      console.log('');
    }

    nextChild = spawn(nextBin, ['start', '-p', String(port)], {
      cwd: dashboardDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
  }
  children.push(nextChild);

  // Start WebSocket server
  const isWin = platform() === 'win32';
  const tsxBinDir = resolve(dashboardDir, 'node_modules/.bin');
  const tsxBin = isWin
    ? resolve(tsxBinDir, 'tsx.cmd')
    : resolve(tsxBinDir, 'tsx');
  const wsScript = resolve(dashboardDir, 'server/ws.ts');

  const wsChild = spawn(tsxBin, [wsScript], {
    cwd: dashboardDir,
    env: {
      ...process.env,
      RALPH_SCRIPTS_DIR: scriptsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
  });
  children.push(wsChild);

  // Pipe output
  nextChild.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.gray(`[Next] ${text}`));
  });
  nextChild.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.yellow(`[Next] ${text}`));
  });
  wsChild.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.gray(`[WS] ${text}`));
  });
  wsChild.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.yellow(`[WS] ${text}`));
  });

  // Handle child exits
  nextChild.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(chalk.red(`[Next] 进程退出，代码: ${code}`));
    }
  });
  wsChild.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(chalk.red(`[WS] 进程退出，代码: ${code}`));
    }
  });

  // Wait a moment for servers to start
  await new Promise((r) => setTimeout(r, 2000));

  const url = `http://localhost:${port}`;
  console.log(brand('  ✓ Ralph 控制台已启动'));
  console.log('');
  console.log(`  ${chalk.bold('Web 控制台:')}  ${chalk.cyan(url)}`);
  console.log(`  ${chalk.bold('WebSocket:')}   ${chalk.cyan(`ws://localhost:${wsPort}`)}`);
  console.log('');
  console.log(chalk.gray('  按 Ctrl+C 停止'));
  console.log('');

  // Auto-open browser
  const shouldOpen = options.open !== false && config.autoOpenBrowser;
  if (shouldOpen) {
    try {
      await open(url);
    } catch {
      // Ignore open failures
    }
  }

  // Graceful shutdown
  const cleanup = () => {
    console.log('');
    console.log(chalk.gray('  正在关闭...'));

    for (const child of children) {
      if (child.pid && !child.killed) {
        try {
          if (platform() === 'win32') {
            execSync(`taskkill /PID ${child.pid} /T /F`, {
              stdio: 'ignore',
            });
          } else {
            child.kill('SIGTERM');
          }
        } catch {
          // Process may already be gone
        }
      }
    }

    console.log(brand('  ✓ Ralph 控制台已停止'));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
