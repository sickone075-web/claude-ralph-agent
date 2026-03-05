#!/usr/bin/env node

// Auto-register Ralph skills into Claude Code on npm install.
// Also scaffolds scripts/ralph/ in existing registered projects.
// Never fails npm install — all errors caught with manual fallback.

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = resolve(__dirname, '..');

const PLUGIN_NAME = 'claude-ralph-agent';
const MARKETPLACE_KEY = `${PLUGIN_NAME}@ralph-marketplace`;
const NPM_KEY = `${PLUGIN_NAME}@npm`;

function readJSON(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// Step 1: Register skills into Claude Code
try {
  const claudeDir = resolve(homedir(), '.claude');
  const pluginsDir = resolve(claudeDir, 'plugins');
  const installedFile = resolve(pluginsDir, 'installed_plugins.json');
  const settingsFile = resolve(claudeDir, 'settings.json');

  const existingInstalled = readJSON(installedFile);
  const existingSettings = readJSON(settingsFile);

  const marketplaceInstalled =
    existingInstalled?.plugins?.[MARKETPLACE_KEY] &&
    existingSettings?.enabledPlugins?.[MARKETPLACE_KEY];

  if (marketplaceInstalled) {
    console.log('\n  ✓ Ralph skills already registered (via marketplace)');
  } else {
    mkdirSync(pluginsDir, { recursive: true });

    const installed = existingInstalled ?? { version: 2, plugins: {} };
    const pkg = readJSON(resolve(PKG_ROOT, 'package.json'));
    const now = new Date().toISOString();

    installed.plugins[NPM_KEY] = [{
      scope: 'user',
      installPath: PKG_ROOT,
      version: pkg.version,
      installedAt: now,
      lastUpdated: now,
    }];
    writeJSON(installedFile, installed);

    const settings = existingSettings ?? {};
    if (!settings.enabledPlugins) settings.enabledPlugins = {};
    settings.enabledPlugins[NPM_KEY] = true;
    writeJSON(settingsFile, settings);

    console.log('\n  ✓ Ralph skills registered to Claude Code');
    console.log('    /ralph:prd  /ralph:task  /ralph:init  /ralph:update  /ralph:start  /ralph:stop');
    console.log('    Restart Claude Code to activate.');
  }
} catch {
  console.log('\n  Ralph skills auto-registration skipped.');
  console.log('  To register manually in Claude Code:');
  console.log('    /plugin marketplace add sickone075-web/claude-ralph-agent');
  console.log('    /plugin install claude-ralph-agent@ralph-marketplace');
}

// Step 2: Scaffold scripts/ralph/ in all registered projects
try {
  const ralphConfigPath = resolve(homedir(), '.ralph', 'config.json');
  if (existsSync(ralphConfigPath)) {
    const config = readJSON(ralphConfigPath);
    const projects = config?.projects ?? [];
    const ralphSrc = resolve(PKG_ROOT, 'scripts/ralph/ralph.sh');
    const claudeSrc = resolve(PKG_ROOT, 'scripts/ralph/CLAUDE.md');

    if (projects.length > 0 && existsSync(ralphSrc)) {
      let scaffolded = 0;
      for (const project of projects) {
        if (!project.path || !existsSync(project.path)) continue;
        const destDir = resolve(project.path, 'scripts/ralph');
        mkdirSync(destDir, { recursive: true });
        copyFileSync(ralphSrc, resolve(destDir, 'ralph.sh'));
        if (existsSync(claudeSrc) && !existsSync(resolve(destDir, 'CLAUDE.md'))) {
          copyFileSync(claudeSrc, resolve(destDir, 'CLAUDE.md'));
        }
        if (!existsSync(resolve(destDir, 'progress.txt'))) {
          writeFileSync(resolve(destDir, 'progress.txt'), '');
        }
        scaffolded++;
      }
      if (scaffolded > 0) {
        console.log(`  ✓ Updated scripts/ralph/ in ${scaffolded} project(s)`);
      }
    }
  }
} catch {
  // Silent — never block npm install
}

console.log('');
