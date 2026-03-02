import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import chalk from 'chalk';
import { readConfig } from '../lib/global-config.js';

const brand = chalk.hex('#6366f1');

function killProcessOnPort(port: number): boolean {
  const isWin = platform() === 'win32';

  try {
    if (isWin) {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const lines = output.trim().split('\n');
      const pids = new Set<string>();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // Process may already be gone
        }
      }

      return pids.size > 0;
    } else {
      const output = execSync(`lsof -ti :${port}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const pids = output.trim().split('\n').filter(Boolean);

      for (const pid of pids) {
        try {
          execSync(`kill ${pid}`, { stdio: 'ignore' });
        } catch {
          // Process may already be gone
        }
      }

      return pids.length > 0;
    }
  } catch {
    // No process found on port
    return false;
  }
}

export async function runStop(): Promise<void> {
  const config = readConfig();
  const port = config.port;
  const wsPort = config.wsPort;

  console.log('');
  console.log(chalk.gray('  正在查找 Ralph 控制台进程...'));

  const killedNext = killProcessOnPort(port);
  const killedWs = killProcessOnPort(wsPort);

  if (killedNext || killedWs) {
    console.log(brand('  ✓ Ralph 控制台已停止'));
  } else {
    console.log(chalk.yellow('  ⚠ 未找到运行中的 Ralph 控制台'));
  }
  console.log('');
}
