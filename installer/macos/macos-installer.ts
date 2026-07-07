import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { generateLaunchdFiles, type InstallerContext } from '../../src/service/installer/index.js';
import type { InstallOptions, PlatformInstaller } from '../common/types.js';
import { run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';

const LABEL = 'com.printagent.agent';

function buildContext(options: InstallOptions): InstallerContext {
  return {
    nodePath: process.execPath,
    projectRoot: options.installDir,
    entryPoint: join(options.installDir, 'dist', 'index.js'),
    logsDir: join(options.installDir, 'logs'),
    serviceUser: '',
  };
}

function plistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

/**
 * Step 6/11 — macOS integration via the LaunchAgent generator built in the service-management
 * phase. Deliberately minimal (per this phase's own "architecture only if implementation is
 * incomplete" allowance for macOS): a PKG installer needs `pkgbuild`/`productbuild`, which only
 * exist on macOS itself, so it can't be built or verified from this Linux environment. The
 * architecture — `PlatformInstaller`, staged scripts, backup/version manifest — is identical to
 * Windows/Linux; only the actual PKG artifact is left as a documented follow-up
 * (see installer/docs/INSTALLATION.md).
 */
export function createMacosInstaller(logger: InstallerLogger): PlatformInstaller {
  function scriptsDir(options: InstallOptions): string {
    return join(options.installDir, 'temp', 'launchd-staging');
  }

  function stageScripts(options: InstallOptions): string {
    const dir = scriptsDir(options);
    mkdirSync(dir, { recursive: true });
    for (const file of generateLaunchdFiles(buildContext(options))) {
      writeFileSync(join(dir, file.relativePath), file.content, 'utf-8');
    }
    return dir;
  }

  return {
    platform: 'macos',

    async registerService(options: InstallOptions): Promise<void> {
      if (options.dev) {
        logger.info('Developer mode — skipping LaunchAgent registration');
        return;
      }
      const dir = stageScripts(options);
      logger.info('Generated LaunchAgent plist and scripts', { dir });
      const result = await run('bash', [join(dir, 'install.sh')]);
      if (result.code !== 0) {
        logger.error('LaunchAgent installation failed', { stderr: result.stderr });
        return;
      }
      logger.info('LaunchAgent installed and loaded');
      if (options.startAutomatically) {
        await run('launchctl', ['start', LABEL]);
      }
    },

    async unregisterService(options: InstallOptions): Promise<void> {
      const dir = scriptsDir(options);
      await run('bash', [join(dir, 'uninstall.sh')]);
    },

    async startService(): Promise<void> {
      await run('launchctl', ['start', LABEL]);
    },

    async stopService(): Promise<void> {
      await run('launchctl', ['stop', LABEL]);
    },

    async restartService(): Promise<void> {
      await run('launchctl', ['stop', LABEL]);
      await run('launchctl', ['start', LABEL]);
    },

    async serviceStatus(): Promise<string> {
      const result = await run('launchctl', ['list', LABEL]);
      return result.code === 0 ? 'loaded' : 'not loaded';
    },
  };
}

export { plistPath };
