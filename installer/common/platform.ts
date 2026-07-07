import { createLinuxInstaller } from '../linux/index.js';
import { createMacosInstaller } from '../macos/index.js';
import { createWindowsInstaller } from '../windows/index.js';
import type { InstallerLogger } from './installer-logger.js';
import type { PlatformInstaller, SupportedPlatform } from './types.js';

export function currentPlatform(): SupportedPlatform {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

/** Step 11 — the single dispatch point every CLI command uses to stay platform-agnostic. */
export function createPlatformInstaller(logger: InstallerLogger): PlatformInstaller {
  switch (currentPlatform()) {
    case 'windows':
      return createWindowsInstaller(logger);
    case 'macos':
      return createMacosInstaller(logger);
    case 'linux':
      return createLinuxInstaller(logger);
  }
}
