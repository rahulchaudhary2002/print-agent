import { existsSync } from 'node:fs';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSystemdFiles, type InstallerContext } from '../../src/service/installer/index.js';
import type { InstallOptions, PlatformInstaller } from '../common/types.js';
import { commandExists, run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';

const SERVICE_NAME = 'print-agent';
const UNIT_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`;

function buildContext(options: InstallOptions): InstallerContext {
  return {
    nodePath: process.execPath,
    projectRoot: options.installDir,
    entryPoint: join(options.installDir, 'dist', 'index.js'),
    logsDir: join(options.installDir, 'logs'),
    serviceUser: 'printagent',
  };
}

/**
 * Step 5/9/10 — Linux systemd integration, reusing the exact generator built in the
 * service-management phase (`generateSystemdFiles`) rather than re-deriving the unit file
 * format here. This module's only job is the *installer* side: writing those generated files
 * to disk, creating the dedicated service user, fixing ownership, and driving `systemctl`.
 */
export function createLinuxInstaller(logger: InstallerLogger): PlatformInstaller {
  const isRoot = process.getuid?.() === 0;

  async function ensureServiceUser(): Promise<void> {
    const check = await run('id', ['-u', 'printagent']);
    if (check.code === 0) {
      return;
    }
    if (!isRoot) {
      logger.warn('Not running as root — skipping service user creation (requires sudo)');
      return;
    }
    await run('useradd', ['--system', '--no-create-home', '--shell', '/usr/sbin/nologin', 'printagent']);
    logger.info('Created dedicated service user "printagent"');
  }

  return {
    platform: 'linux',

    async registerService(options: InstallOptions): Promise<void> {
      if (options.dev) {
        logger.info('Developer mode — skipping systemd service registration');
        return;
      }
      const context = buildContext(options);
      const files = generateSystemdFiles(context);
      const stagingDir = join(options.installDir, 'temp', 'systemd-staging');
      mkdirSync(stagingDir, { recursive: true });
      for (const file of files) {
        const path = join(stagingDir, file.relativePath);
        writeFileSync(path, file.content, 'utf-8');
        if (file.executable) {
          chmodSync(path, 0o755);
        }
      }
      logger.info('Generated systemd unit and management scripts', { stagingDir });

      await ensureServiceUser();

      if (!isRoot) {
        logger.warn(`Not running as root — copy ${stagingDir}/print-agent.service to ${UNIT_PATH} and run 'systemctl daemon-reload && systemctl enable print-agent' manually`);
        return;
      }

      await run('cp', [join(stagingDir, 'print-agent.service'), UNIT_PATH]);
      await run('chown', ['-R', 'printagent:printagent', join(options.installDir, 'storage')]);
      await run('chown', ['-R', 'printagent:printagent', join(options.installDir, 'logs')]);
      await run('systemctl', ['daemon-reload']);
      await run('systemctl', ['enable', SERVICE_NAME]);
      logger.info('systemd service registered and enabled');

      if (options.startAutomatically) {
        await run('systemctl', ['start', SERVICE_NAME]);
        logger.info('systemd service started');
      }
    },

    async unregisterService(): Promise<void> {
      if (!isRoot) {
        logger.warn('Not running as root — cannot unregister the systemd service automatically');
        return;
      }
      await run('systemctl', ['disable', '--now', SERVICE_NAME]);
      if (existsSync(UNIT_PATH)) {
        await run('rm', ['-f', UNIT_PATH]);
      }
      await run('systemctl', ['daemon-reload']);
      logger.info('systemd service unregistered');
    },

    async startService(): Promise<void> {
      await run('systemctl', ['start', SERVICE_NAME]);
    },

    async stopService(): Promise<void> {
      await run('systemctl', ['stop', SERVICE_NAME]);
    },

    async restartService(): Promise<void> {
      await run('systemctl', ['restart', SERVICE_NAME]);
    },

    async serviceStatus(): Promise<string> {
      const hasSystemctl = await commandExists('systemctl');
      if (!hasSystemctl) {
        return 'unknown (systemctl not available)';
      }
      const result = await run('systemctl', ['is-active', SERVICE_NAME]);
      return result.stdout.trim() || 'unknown';
    },
  };
}
