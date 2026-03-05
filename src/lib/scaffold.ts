import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the package root directory (where package.json lives).
 * Works from both dist/lib/ (compiled) and src/lib/ (dev).
 */
export function getPackageRoot(): string {
  // dist/lib/scaffold.js → package root (2 levels up)
  return resolve(__dirname, '../..');
}

/**
 * Scaffold scripts/ralph/ directory in a user's project.
 * Copies ralph.sh, CLAUDE.md, and creates progress.txt if missing.
 * Never overwrites existing files (except ralph.sh which should stay current).
 */
export function scaffoldProject(projectPath: string): { created: string[]; skipped: string[] } {
  const pkgRoot = getPackageRoot();
  const srcDir = resolve(pkgRoot, 'scripts/ralph');
  const destDir = resolve(projectPath, 'scripts/ralph');

  const created: string[] = [];
  const skipped: string[] = [];

  // Ensure destination directory exists
  mkdirSync(destDir, { recursive: true });

  // Always copy ralph.sh (keep it up to date with the installed version)
  const ralphSrc = resolve(srcDir, 'ralph.sh');
  const ralphDest = resolve(destDir, 'ralph.sh');
  if (existsSync(ralphSrc)) {
    copyFileSync(ralphSrc, ralphDest);
    created.push('scripts/ralph/ralph.sh');
  }

  // Copy CLAUDE.md only if not exists (user may have customized it)
  const claudeSrc = resolve(srcDir, 'CLAUDE.md');
  const claudeDest = resolve(destDir, 'CLAUDE.md');
  if (existsSync(claudeSrc) && !existsSync(claudeDest)) {
    copyFileSync(claudeSrc, claudeDest);
    created.push('scripts/ralph/CLAUDE.md');
  } else if (existsSync(claudeDest)) {
    skipped.push('scripts/ralph/CLAUDE.md (already exists)');
  }

  // Create empty progress.txt if not exists
  const progressDest = resolve(destDir, 'progress.txt');
  if (!existsSync(progressDest)) {
    writeFileSync(progressDest, '');
    created.push('scripts/ralph/progress.txt');
  } else {
    skipped.push('scripts/ralph/progress.txt (already exists)');
  }

  // Copy prd.json.example if no prd.json exists
  const prdDest = resolve(destDir, 'prd.json');
  const prdExampleSrc = resolve(srcDir, 'prd.json.example');
  if (!existsSync(prdDest) && existsSync(prdExampleSrc)) {
    copyFileSync(prdExampleSrc, resolve(destDir, 'prd.json.example'));
    created.push('scripts/ralph/prd.json.example');
  }

  return { created, skipped };
}
