#!/usr/bin/env node
/**
 * prepare-standalone script: replace the standalone package.json with a
 * minimal one that only lists runtime dependencies needed by the Next.js
 * production server. This keeps `npm install` in postinstall fast and light.
 */
const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', 'dashboard', '.next', 'standalone');
const pkgPath = path.join(standaloneDir, 'package.json');

if (!fs.existsSync(standaloneDir)) {
  console.error('Standalone directory not found. Run `next build` first.');
  process.exit(1);
}

// Read the full dashboard package.json to extract exact versions
const dashPkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'package.json'), 'utf-8')
);

// Only keep deps that the standalone server actually needs
const runtimeDeps = ['next', 'react', 'react-dom'];
const deps = {};
for (const dep of runtimeDeps) {
  if (dashPkg.dependencies[dep]) {
    deps[dep] = dashPkg.dependencies[dep];
  }
}

const minimalPkg = {
  name: 'ralph-dashboard-standalone',
  version: dashPkg.version || '0.0.0',
  private: true,
  dependencies: deps,
};

fs.writeFileSync(pkgPath, JSON.stringify(minimalPkg, null, 2) + '\n');
console.log('[ralph] Standalone package.json prepared with deps:', Object.keys(deps).join(', '));

// Fix hardcoded absolute paths in server.js so it works on any machine
const serverJsPath = path.join(standaloneDir, 'server.js');
if (fs.existsSync(serverJsPath)) {
  let serverJs = fs.readFileSync(serverJsPath, 'utf-8');
  // Replace hardcoded outputFileTracingRoot with a __dirname-relative value
  serverJs = serverJs.replace(
    /"outputFileTracingRoot":"[^"]+"/g,
    '"outputFileTracingRoot":"."'
  );
  // Replace hardcoded turbopack.root
  serverJs = serverJs.replace(
    /"root":"[^"]+?dashboard"/g,
    '"root":"."'
  );
  // Replace hardcoded tailwindcss resolve alias path
  serverJs = serverJs.replace(
    /"tailwindcss":"[^"]+?node_modules[\\/]+tailwindcss"/g,
    '"tailwindcss":"tailwindcss"'
  );
  fs.writeFileSync(serverJsPath, serverJs);
  console.log('[ralph] Standalone server.js: hardcoded paths fixed.');
}
