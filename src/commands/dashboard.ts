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
  const dashboardDir = getDashboardDir();
  const scriptsDir = getScriptsDir();

  if (!existsSync(dashboardDir)) {
    console.log(chalk.red('✗ dashboard 目录不存在'));
    console.log(chalk.gray(`  路径: ${dashboardDir}`));
    process.exit(1);
  }

  const portInUse = await isPortInUse(port);
  if (portInUse) {
    console.log(chalk.red(`✗ 端口 ${port} 已被占用`));
    console.log(chalk.gray('  请关闭占用端口的进程后重试'));
    process.exit(1);
  }

  console.log('');
  console.log(brand('  🚀 Ralph 控制台启动中...'));
  console.log('');

  const env = {
    ...process.env,
    PORT: String(port),
    RALPH_SCRIPTS_DIR: scriptsDir,
  };

  // Use bundled server or fallback to tsx for development
  const bundledServer = resolve(__dirname, '../dashboard-server.cjs');
  let serverChild: ChildProcess;

  if (existsSync(bundledServer)) {
    serverChild = spawn('node', [bundledServer], {
      cwd: dashboardDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    // Dev fallback: run server/index.ts with tsx
    const serverEntry = resolve(dashboardDir, 'server/index.ts');
    if (!existsSync(serverEntry)) {
      console.log(chalk.red('✗ 未找到服务器入口文件'));
      console.log(chalk.gray(`  路径: ${serverEntry}`));
      process.exit(1);
    }

    const isWin = platform() === 'win32';
    const tsxBin = resolve(dashboardDir, 'node_modules/.bin', isWin ? 'tsx.cmd' : 'tsx');
    serverChild = spawn(tsxBin, [serverEntry], {
      cwd: dashboardDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
  }

  serverChild.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.gray(`  ${text}`));
  });
  serverChild.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(chalk.yellow(`  ${text}`));
  });

  serverChild.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(chalk.red(`  服务器进程退出，代码: ${code}`));
    }
  });

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 2000));

  const url = `http://localhost:${port}`;
  console.log(brand('  ✓ Ralph 控制台已启动'));
  console.log('');
  console.log(`  ${chalk.bold('控制台:')}  ${chalk.cyan(url)}`);
  console.log('');
  console.log(chalk.gray('  按 Ctrl+C 停止'));
  console.log('');

  const shouldOpen = options.open !== false && config.autoOpenBrowser;
  if (shouldOpen) {
    try {
      await open(url);
    } catch {
      // Ignore open failures
    }
  }

  const cleanup = () => {
    console.log('');
    console.log(chalk.gray('  正在关闭...'));

    if (serverChild.pid && !serverChild.killed) {
      try {
        if (platform() === 'win32') {
          execSync(`taskkill /PID ${serverChild.pid} /T /F`, {
            stdio: 'ignore',
          });
        } else {
          serverChild.kill('SIGTERM');
        }
      } catch {
        // Process may already be gone
      }
    }

    console.log(brand('  ✓ Ralph 控制台已停止'));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
