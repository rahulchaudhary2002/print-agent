import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BACKUPS_DIR,
  CACHE_DIR,
  CRASH_DUMPS_DIR,
  LOGS_DIR,
  STORAGE_DIR,
  TEMP_DIR,
} from '../../src/utils/paths.util.js';
import type { InstallerLogger } from './installer-logger.js';

/**
 * Step 2 — the runtime directory layout, resolved against a given install directory rather
 * than always `PROJECT_ROOT` (the app's own `paths.util.ts` always resolves relative to itself,
 * which is correct once installed *into* `installDir`, but the installer needs to create these
 * directories under an arbitrary target before the app ever runs there). Reuses the exact same
 * directory names the app's own path constants use, so a fresh install's layout and a dev
 * checkout's layout are identical — no separate "installed" convention to keep in sync.
 */
export function runtimeDirectories(installDir: string): string[] {
  return [
    join(installDir, 'storage'),
    join(installDir, 'logs'),
    join(installDir, 'temp'),
    join(installDir, 'storage', 'cache'),
    join(installDir, 'storage', 'crash-dumps'),
    join(installDir, 'storage', 'backups'),
  ];
}

/** When running the installer in-place (installDir === this checkout), the real constants apply directly. */
export function currentCheckoutRuntimeDirectories(): string[] {
  return [STORAGE_DIR, LOGS_DIR, TEMP_DIR, CACHE_DIR, CRASH_DUMPS_DIR, BACKUPS_DIR];
}

export function ensureRuntimeDirectories(installDir: string, logger: InstallerLogger): void {
  for (const dir of runtimeDirectories(installDir)) {
    mkdirSync(dir, { recursive: true });
    logger.info('Ensured runtime directory', { dir });
  }
}
