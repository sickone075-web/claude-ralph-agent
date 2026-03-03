#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInit } from '../commands/init.js';
import { runStart } from '../commands/start.js';
import { runStop } from '../commands/stop.js';
import { runAddProject } from '../commands/add-project.js';
import { runAddRepo } from '../commands/add-repo.js';
import { runRemoveRepo } from '../commands/remove-repo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('ralph')
  .description('Ralph 管理工具 — 安装引导、启动控制台、管理项目。AI 对话请在 Claude Code 中进行。')
  .version(pkg.version, '-v, --version');

program
  .command('init')
  .description('交互式初始化引导')
  .action(async () => {
    await runInit();
  });

program
  .command('start')
  .description('启动 Web 控制台')
  .option('--no-open', '不自动打开浏览器')
  .action(async (opts) => {
    await runStart({ open: opts.open });
  });

program
  .command('stop')
  .description('停止 Web 控制台')
  .action(async () => {
    await runStop();
  });

program
  .command('config')
  .description('管理配置')
  .action(() => {
    console.log('ralph config - 即将实现');
  });

program
  .command('add-project')
  .description('添加项目')
  .action(async () => {
    await runAddProject();
  });

program
  .command('add-repo')
  .description('为当前活跃项目添加仓库')
  .action(async () => {
    await runAddRepo();
  });

program
  .command('remove-repo')
  .description('从当前活跃项目移除仓库')
  .action(async () => {
    await runRemoveRepo();
  });

program.action(() => {
  program.outputHelp();
});

program.parse();
