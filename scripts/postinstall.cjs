#!/usr/bin/env node
/**
 * postinstall script: install standalone server dependencies.
 *
 * npm always strips node_modules when publishing, so the Next.js standalone
 * build loses its runtime deps. This script restores them by running
 * `npm install --omit=dev` inside the standalone directory which already
 * contains a minimal package.json generated during prepublishOnly.
 */
const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', 'dashboard', '.next', 'standalone');
const pkgJson = path.join(standaloneDir, 'package.json');

// Only run when standalone build exists but node_modules is missing
if (existsSync(pkgJson) && !existsSync(path.join(standaloneDir, 'node_modules', 'next'))) {
  console.log('[ralph] Installing dashboard runtime dependencies...');
  try {
    execSync('npm install --omit=dev --no-audit --no-fund', {
      cwd: standaloneDir,
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('[ralph] Dashboard dependencies installed.');
  } catch (err) {
    console.error('[ralph] Failed to install dashboard dependencies:', err.message);
    console.error('[ralph] You can try manually: cd ' + standaloneDir + ' && npm install --omit=dev');
    // Don't exit(1) — let the main package install succeed
  }
}
