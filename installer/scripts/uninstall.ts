import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { InstallerLogger, REPO_ROOT, createPlatformInstaller } from '../common/index.js';
import { parseArgs, flag, option } from './arg-parser.js';
import { promptYesNo } from './prompts.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const installDir = option(args, 'install-dir', REPO_ROOT);
  const silent = flag(args, 'silent', false);
  let purge = flag(args, 'purge', false);

  const logger = new InstallerLogger(join(installDir, 'logs', 'installer.log'));
  logger.info('Starting uninstall', { installDir, purge });

  if (!silent && !purge) {
    purge = await promptYesNo('Also delete configuration, database, and logs? This cannot be undone', false);
  }

  const platformInstaller = createPlatformInstaller(logger);

  try {
    await platformInstaller.stopService({
      installDir,
      serviceName: 'print-agent',
      startAutomatically: false,
      desktopShortcut: false,
      launchAfterInstall: false,
      silent,
      dev: false,
    });
    // No unconditional "stopped" log here — `stopService` itself already logs the ground truth
    // (including when it can't act because it isn't running as root/Administrator).
  } catch (error) {
    logger.warn('Could not stop service (it may not have been registered)', { error: error instanceof Error ? error.message : String(error) });
  }

  try {
    await platformInstaller.unregisterService({
      installDir,
      serviceName: 'print-agent',
      startAutomatically: false,
      desktopShortcut: false,
      launchAfterInstall: false,
      silent,
      dev: false,
    });
  } catch (error) {
    logger.warn('Could not unregister service', { error: error instanceof Error ? error.message : String(error) });
  }

  // Step 10 — temporary files are always removed; they're disposable by definition.
  const tempDir = join(installDir, 'temp');
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    logger.info('Removed temporary files', { tempDir });
  }

  // Application binaries — always removed, regardless of --purge.
  for (const entry of ['dist', 'node_modules']) {
    const path = join(installDir, entry);
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true });
      logger.info('Removed application binaries', { path });
    }
  }

  if (purge) {
    // Deliberate: `logs/` (containing the installer's own log file) is purged too, and the very
    // next `logger.info()` call below recreates it with just the purge confirmation lines —
    // `InstallerLogger` always ensures its directory exists before writing. That's a feature,
    // not a bug: a purge should still leave a receipt that it happened.
    for (const entry of ['storage', 'logs']) {
      const path = join(installDir, entry);
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
        logger.info('Purged persistent data', { path });
      }
    }
  } else {
    logger.info('Preserved configuration, database, and logs (pass --purge to remove them)', {
      storage: join(installDir, 'storage'),
      logs: join(installDir, 'logs'),
    });
  }

  logger.info('Uninstall completed');
}

main().catch((error: unknown) => {
  console.error('Uninstall failed', error);
  process.exitCode = 1;
});
