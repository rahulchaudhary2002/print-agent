import { existsSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { commandExists, run } from '../common/index.js';
import type { InstallerLogger } from '../common/index.js';

/**
 * Step 13 — zips an already-staged runtime package (Step 4) as-is: no service registration, no
 * install directory, just "unzip and run the executable inside." Useful for development and
 * troubleshooting, per the spec — the same runtime package a real install uses, just not
 * installed.
 */
export async function buildPortablePackage(input: {
  runtimeDir: string;
  outputPath: string;
  logger: InstallerLogger;
}): Promise<string | null> {
  const { runtimeDir, outputPath, logger } = input;

  if (!(await commandExists('zip'))) {
    logger.warn('zip not found — skipping portable package build');
    return null;
  }
  if (!existsSync(runtimeDir)) {
    logger.error('Runtime package directory does not exist, cannot build portable package', { runtimeDir });
    return null;
  }

  const parentDir = dirname(runtimeDir);
  const folderName = basename(runtimeDir);
  const result = await run('zip', ['-r', '-q', outputPath, folderName], { cwd: parentDir });
  if (result.code !== 0) {
    logger.error('Failed to build portable zip', { stderr: result.stderr });
    return null;
  }

  logger.info('Built portable package', { outputPath });
  return outputPath;
}

export function portableOutputName(version: string): string {
  return `UniversalPrintAgent-Portable-${version}.zip`;
}
