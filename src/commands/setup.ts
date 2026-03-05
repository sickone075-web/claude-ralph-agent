import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { readConfig } from '../lib/global-config.js';
import { scaffoldProject } from '../lib/scaffold.js';

const OK = chalk.green;
const DIM = chalk.dim;
const ERR = chalk.red;
const WARN = chalk.yellow;

export async function runSetup(): Promise<void> {
  const config = readConfig();

  if (config.projects.length === 0) {
    console.log(ERR('\n  没有已注册的项目。请先运行 ralph add-project 添加项目。\n'));
    return;
  }

  console.log(chalk.bold('\n  📦 初始化项目 Ralph 运行环境\n'));

  for (const project of config.projects) {
    console.log(chalk.bold(`  ${project.name}`) + DIM(` (${project.path})`));

    if (!existsSync(project.path)) {
      console.log(WARN(`    ⚠ 路径不存在，跳过\n`));
      continue;
    }

    const { created, skipped } = scaffoldProject(project.path);

    if (created.length === 0) {
      console.log(DIM('    所有文件已就绪'));
    }
    for (const f of created) {
      console.log(OK(`    ✓ ${f}`));
    }
    for (const f of skipped) {
      console.log(DIM(`    - ${f}`));
    }
    console.log('');
  }

  console.log(OK('  完成！现在可以使用 /ralph:start 启动循环。\n'));
}
