import { existsSync, renameSync, rmSync } from 'node:fs';
import type { InstallerLogger } from '../common/index.js';

/**
 * Step 16 — if `release/<version>/` already exists (re-running the pipeline for a version
 * that was already built), rename it aside before starting, rather than building on top of or
 * silently overwriting a previous successful release. Call `commit()` once the new build
 * actually succeeds (removes the aside-backup); on failure, call `rollback()` instead to
 * restore it, so a failed re-run never destroys a previously good release.
 */
export function prepareReleaseFolderBackup(releaseDir: string, logger: InstallerLogger): { backupPath: string | null; commit: () => void; rollback: () => void } {
  if (!existsSync(releaseDir)) {
    return { backupPath: null, commit: () => {}, rollback: () => {} };
  }

  const backupPath = `${releaseDir}.bak-${Date.now()}`;
  renameSync(releaseDir, backupPath);
  logger.info('Existing release folder moved aside before rebuilding', { releaseDir, backupPath });

  return {
    backupPath,
    commit: () => {
      rmSync(backupPath, { recursive: true, force: true });
      logger.info('Previous release backup discarded — new build succeeded', { backupPath });
    },
    rollback: () => {
      rmSync(releaseDir, { recursive: true, force: true });
      renameSync(backupPath, releaseDir);
      logger.warn('Build failed — restored the previous release folder', { releaseDir, backupPath });
    },
  };
}

/** Step 16 — always cleans build scratch space, whether the pipeline succeeded or not. */
export function cleanTemporaryDirectories(tempDirs: string[], logger: InstallerLogger): void {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  logger.info('Cleaned temporary build directories', { count: tempDirs.length });
}

/** Step 16 — turns a raw thrown error into a message that says what stage failed and what to check next, not just a stack trace. */
export function describeFailure(stage: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const hints: Record<string, string> = {
    Clean: 'Check filesystem permissions on the repo root and release/ directory.',
    'Compile TypeScript': "Run 'npm run typecheck' directly to see the full compiler output.",
    'Build Print Agent': "Run 'npm run build' directly — this stage just re-runs it.",
    'Package Runtime': 'Check that esbuild is installed (npm install) and that dist/index.js exists.',
    'Generate Executable': 'Check installer/release/executable-packager.ts logs for the esbuild/launcher step that failed.',
    'Generate Installers': 'Missing packaging tools (dpkg-deb, rpmbuild, appimagetool, makensis) degrade gracefully and are not fatal — a fatal error here is something else.',
    'Generate Checksums': 'Check that every artifact path returned by the packaging stage actually exists on disk.',
  };
  const hint = hints[stage] ?? 'Check the corresponding log file under release/<version>/logs/.';
  return `Release pipeline failed at stage "${stage}": ${message}\nSuggested next step: ${hint}`;
}
