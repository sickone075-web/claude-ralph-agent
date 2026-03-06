import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
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
 * Scaffold Ralph for a user's project using three-layer directory structure:
 *
 * ~/.ralph/                 — global scripts & config
 *   ├── ralph.sh
 *   └── CLAUDE.md
 *
 * $PROJECT/.ralph/          — project-level PRD, progress, archive
 *   ├── prd.json
 *   ├── progress.txt
 *   └── archive/
 *
 * ~/.ralph/projects/<name>/ — runtime state (created by ralph.sh at runtime)
 */
export function scaffoldProject(projectPath: string): { created: string[]; skipped: string[] } {
  const pkgRoot = getPackageRoot();
  const srcDir = resolve(pkgRoot, 'scripts/ralph');
  const ralphHome = join(homedir(), '.ralph');
  const projectRalphDir = resolve(projectPath, '.ralph');

  const created: string[] = [];
  const skipped: string[] = [];

  // Ensure directories exist
  mkdirSync(ralphHome, { recursive: true });
  mkdirSync(projectRalphDir, { recursive: true });

  // --- Global files (~/.ralph/) ---

  // Always copy ralph.sh (keep it up to date with the installed version)
  const ralphSrc = resolve(srcDir, 'ralph.sh');
  const ralphDest = join(ralphHome, 'ralph.sh');
  if (existsSync(ralphSrc)) {
    copyFileSync(ralphSrc, ralphDest);
    created.push('~/.ralph/ralph.sh');
  }

  // Copy CLAUDE.md only if not exists (user may have customized it)
  const claudeSrc = resolve(srcDir, 'CLAUDE.md');
  const claudeDest = join(ralphHome, 'CLAUDE.md');
  if (existsSync(claudeSrc) && !existsSync(claudeDest)) {
    copyFileSync(claudeSrc, claudeDest);
    created.push('~/.ralph/CLAUDE.md');
  } else if (existsSync(claudeDest)) {
    skipped.push('~/.ralph/CLAUDE.md (already exists)');
  }

  // --- Project files ($PROJECT/.ralph/) ---

  // Create empty progress.txt if not exists
  const progressDest = resolve(projectRalphDir, 'progress.txt');
  if (!existsSync(progressDest)) {
    writeFileSync(progressDest, '');
    created.push('.ralph/progress.txt');
  } else {
    skipped.push('.ralph/progress.txt (already exists)');
  }

  // Copy prd.json.example if no prd.json exists
  const prdDest = resolve(projectRalphDir, 'prd.json');
  const prdExampleSrc = resolve(srcDir, 'prd.json.example');
  if (!existsSync(prdDest) && existsSync(prdExampleSrc)) {
    copyFileSync(prdExampleSrc, resolve(projectRalphDir, 'prd.json.example'));
    created.push('.ralph/prd.json.example');
  }

  // Create archive directory
  const archiveDir = resolve(projectRalphDir, 'archive');
  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
    created.push('.ralph/archive/');
  }

  return { created, skipped };
}
