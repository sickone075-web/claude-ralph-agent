import chalk from 'chalk';
import inquirer from 'inquirer';
import { readConfig, writeConfig } from '../lib/global-config.js';

const BRAND = chalk.hex('#6366f1');
const OK = chalk.green;
const ERR = chalk.red;

export async function runRemoveRepo(): Promise<void> {
  console.log(BRAND('\n🗑️  移除仓库\n'));

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

  const repos = project.repositories ?? {};
  const repoNames = Object.keys(repos);

  if (repoNames.length === 0) {
    console.log(ERR('❌ 当前项目没有配置仓库。\n'));
    return;
  }

  console.log(chalk.gray(`当前项目：${project.name}\n`));

  // Select repo to remove
  const { repoName } = await inquirer.prompt<{ repoName: string }>([
    {
      type: 'list',
      name: 'repoName',
      message: '选择要移除的仓库：',
      choices: repoNames,
    },
  ]);

  const repo = repos[repoName];
  console.log(chalk.gray(`\n  名称：${repoName}`));
  console.log(chalk.gray(`  路径：${repo.path}`));
  console.log(chalk.gray(`  类型：${repo.type}`));
  console.log(chalk.gray(`  优先级：${repo.priority}`));
  if (repo.checks?.length) {
    console.log(chalk.gray(`  检查命令：${repo.checks.join(', ')}`));
  }

  // Confirm deletion
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `确认删除仓库 "${repoName}"？`,
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log(chalk.gray('\n已取消。\n'));
    return;
  }

  // Remove the repo
  delete repos[repoName];

  // If repositories is now empty, remove the field entirely
  if (Object.keys(repos).length === 0) {
    delete project.repositories;
  }

  writeConfig(config);

  console.log(OK(`\n✅ 仓库 "${repoName}" 已从项目 "${project.name}" 中移除\n`));
}
