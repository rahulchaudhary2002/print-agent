import { join } from 'node:path';
import { InstallerLogger } from '../common/index.js';

export interface ReleaseLoggers {
  build: InstallerLogger;
  installer: InstallerLogger;
  verification: InstallerLogger;
  release: InstallerLogger;
}

/** Step 15 — one log file per concern, all under `release/<version>/logs/`. */
export function createReleaseLoggers(logsDir: string): ReleaseLoggers {
  return {
    build: new InstallerLogger(join(logsDir, 'build.log')),
    installer: new InstallerLogger(join(logsDir, 'installer.log')),
    verification: new InstallerLogger(join(logsDir, 'verification.log')),
    release: new InstallerLogger(join(logsDir, 'release.log')),
  };
}
