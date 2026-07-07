import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { InstallerLogger } from './installer-logger.js';

/** Everything that's "application binaries" — copied fresh on every install/upgrade. */
const APPLICATION_ENTRIES = ['dist', 'package.json', 'package-lock.json', 'node_modules'];

/** Everything that's user data — never touched by an install/upgrade copy, ever. */
const USER_DATA_ENTRIES = ['storage', 'logs', 'temp'];

/**
 * Step 2/7 — copies only the application binaries from a build output into the install
 * directory, explicitly never touching `storage/`, `logs/`, or `temp/`. This is the mechanism
 * that makes upgrades safe: config.json, the database, printer profiles, and logs simply never
 * appear in the copy list, so there's nothing to accidentally overwrite. New configuration
 * fields introduced by a newer app version are picked up automatically the next time
 * `ConfigService.load()` merges the (unchanged) file over `DEFAULT_CONFIG` — no migration step
 * needs to run for that case, it's a property of how the app already loads its config.
 */
export function copyApplicationFiles(sourceDir: string, targetDir: string, logger: InstallerLogger): void {
  if (sourceDir === targetDir) {
    logger.info('Installing in place — source and target are the same directory, skipping file copy');
    return;
  }
  for (const entry of APPLICATION_ENTRIES) {
    const source = join(sourceDir, entry);
    if (!existsSync(source)) {
      continue;
    }
    const destination = join(targetDir, entry);
    cpSync(source, destination, { recursive: true, force: true });
    logger.info('Copied application entry', { entry });
  }
  for (const entry of USER_DATA_ENTRIES) {
    logger.info('Preserved user data entry (not touched)', { entry: join(targetDir, entry) });
  }
}

export function isInstalled(installDir: string): boolean {
  return existsSync(join(installDir, 'dist', 'index.js'));
}
