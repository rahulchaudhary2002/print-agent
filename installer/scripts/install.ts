import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import {
  BackupManager,
  InstallerLogger,
  REPO_ROOT,
  buildVersionManifest,
  commandExists,
  copyApplicationFiles,
  createPlatformInstaller,
  ensureRuntimeDirectories,
  isInstalled,
  run,
  validateEnvironment,
  writeVersionManifest,
  type InstallOptions,
} from '../common/index.js';
import { parseArgs, flag, option } from './arg-parser.js';
import { promptText, promptYesNo } from './prompts.js';

async function resolveOptions(): Promise<InstallOptions> {
  const args = parseArgs(process.argv.slice(2));
  const silent = flag(args, 'silent', false) || flag(args, 'dev', false);
  const dev = flag(args, 'dev', false);

  let installDir = option(args, 'install-dir', REPO_ROOT);
  let serviceName = option(args, 'service-name', 'print-agent');
  let startAutomatically = flag(args, 'autostart', true);
  let desktopShortcut = flag(args, 'desktop-shortcut', false);
  let launchAfterInstall = flag(args, 'launch', !silent);

  if (!silent) {
    installDir = await promptText('Installation path', installDir);
    serviceName = await promptText('Service name', serviceName);
    startAutomatically = await promptYesNo('Start automatically at boot', startAutomatically);
    desktopShortcut = await promptYesNo('Create a desktop shortcut', desktopShortcut);
    launchAfterInstall = await promptYesNo('Launch after install', launchAfterInstall);
  }

  return {
    installDir,
    serviceName,
    startAutomatically,
    desktopShortcut,
    launchAfterInstall,
    silent,
    dev,
  };
}

function readMigrationState(databasePath: string): { schemaVersion: number; migrationVersion: string | null } {
  if (!existsSync(databasePath)) {
    return { schemaVersion: 0, migrationVersion: null };
  }
  const db = new Database(databasePath, { readonly: true });
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number } | undefined;
    // `applied_at` is second-precision — a fresh install applies every migration within the same
    // second, so ties on that column alone don't reliably identify the *last* one. `_migrations`
    // is append-only, so `rowid` (strictly increasing with insertion order) breaks the tie correctly.
    const latest = db.prepare('SELECT name FROM _migrations ORDER BY applied_at DESC, rowid DESC LIMIT 1').get() as { name: string } | undefined;
    return { schemaVersion: row?.count ?? 0, migrationVersion: latest?.name ?? null };
  } catch {
    return { schemaVersion: 0, migrationVersion: null };
  } finally {
    db.close();
  }
}

function createDesktopShortcut(logger: InstallerLogger): void {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    logger.warn('Desktop shortcut creation is only implemented for Linux (.desktop) in this phase');
    return;
  }
  const appsDir = join(process.env['HOME'] ?? '~', '.local', 'share', 'applications');
  mkdirSync(appsDir, { recursive: true });
  const desktopFile = join(appsDir, 'print-agent.desktop');
  writeFileSync(
    desktopFile,
    `[Desktop Entry]\nType=Application\nName=Print Agent\nComment=Universal Print Agent\nExec=xdg-open http://127.0.0.1:3210/docs\nIcon=utilities-terminal\nCategories=Utility;\nTerminal=false\n`,
    'utf-8',
  );
  logger.info('Created desktop shortcut', { desktopFile });
}

async function verifyInstallation(logger: InstallerLogger): Promise<void> {
  logger.info('Verifying installation (Step 16)...');
  const checks: { name: string; url: string }[] = [
    { name: 'REST API / health', url: 'http://127.0.0.1:3210/api/v1/health' },
    { name: 'Service status', url: 'http://127.0.0.1:3210/api/v1/service/status' },
    { name: 'Service workers', url: 'http://127.0.0.1:3210/api/v1/service/workers' },
  ];
  for (const check of checks) {
    try {
      const response = await fetch(check.url, { signal: AbortSignal.timeout(5000) });
      logger.info(`Verification: ${check.name}`, { status: response.status, ok: response.ok });
    } catch (error) {
      logger.warn(`Verification: ${check.name} unreachable (service may still be starting)`, { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function main(): Promise<void> {
  const options = await resolveOptions();
  mkdirSync(join(options.installDir, 'logs'), { recursive: true });
  const logger = new InstallerLogger(join(options.installDir, 'logs', 'installer.log'));

  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };
  const wasAlreadyInstalled = isInstalled(options.installDir);
  const action = wasAlreadyInstalled ? 'upgrade' : 'install';
  logger.info(`Starting ${action}`, { installDir: options.installDir, version: packageJson.version, dev: options.dev });

  const environmentReport = await validateEnvironment({ installDir: options.installDir, port: 3210 });
  for (const issue of environmentReport.issues) {
    (issue.severity === 'fatal' ? logger.error : logger.warn).call(logger, issue.message, { check: issue.check });
  }
  if (!environmentReport.ok) {
    logger.error(`Startup validation failed, aborting ${action}`);
    process.exitCode = 1;
    return;
  }

  ensureRuntimeDirectories(options.installDir, logger);

  const backupManager = new BackupManager(join(options.installDir, 'storage', 'backups'), logger);
  let backupId: string | null = null;
  if (wasAlreadyInstalled) {
    const previousManifestPath = join(options.installDir, 'storage', 'version.json');
    const previousVersion = existsSync(previousManifestPath)
      ? (JSON.parse(readFileSync(previousManifestPath, 'utf-8')) as { installedVersion?: string }).installedVersion ?? null
      : null;
    const backup = backupManager.create('upgrade', previousVersion, [
      join(options.installDir, 'storage', 'config.json'),
      join(options.installDir, 'storage', 'print-agent.db'),
      join(options.installDir, 'storage', 'print-agent.db-wal'),
      join(options.installDir, 'storage', 'print-agent.db-shm'),
      join(options.installDir, 'dist'),
      join(options.installDir, 'package.json'),
    ]);
    backupId = backup.id;
    logger.info('Pre-upgrade backup created', { backupId });
  }

  try {
    // Step 7 — config.json/database/logs are never in this list; copyApplicationFiles only ever
    // touches application binaries, so an upgrade can't clobber user data even by accident.
    copyApplicationFiles(REPO_ROOT, options.installDir, logger);

    // Step 8 — run pending migrations via the app's own migration runner (no migration logic here).
    const migrateEntry = join(options.installDir, 'dist', 'cli', 'migrate.js');
    if (existsSync(migrateEntry)) {
      const migrateResult = await run(process.execPath, [migrateEntry]);
      if (migrateResult.code !== 0) {
        throw new Error(`Database migration failed: ${migrateResult.stderr || migrateResult.stdout}`);
      }
      logger.info('Database migrations applied');
    }

    if (!options.dev && !(await commandExists('node'))) {
      logger.warn('node executable not found on PATH — the installed service may fail to start');
    }

    const platformInstaller = createPlatformInstaller(logger);
    await platformInstaller.registerService(options);

    if (options.desktopShortcut) {
      createDesktopShortcut(logger);
    }

    const { schemaVersion, migrationVersion } = readMigrationState(join(options.installDir, 'storage', 'print-agent.db'));
    const manifest = buildVersionManifest(join(options.installDir, 'storage', 'version.json'), {
      installedVersion: packageJson.version,
      schemaVersion,
      configVersion: 1,
      migrationVersion,
      buildNumber: process.env['BUILD_NUMBER'] ?? 'local',
    });
    writeVersionManifest(join(options.installDir, 'storage', 'version.json'), manifest);
    logger.info('Wrote version manifest', manifest as unknown as Record<string, unknown>);

    if (options.dev && options.launchAfterInstall) {
      logger.info('Developer mode — launching portably (not as a service)');
      const child = spawn(process.execPath, [join(options.installDir, 'dist', 'index.js')], {
        detached: true,
        stdio: 'ignore',
        cwd: options.installDir,
      });
      child.unref();
    } else if (options.startAutomatically) {
      await verifyInstallation(logger);
    }

    logger.info(`${action === 'upgrade' ? 'Upgrade' : 'Installation'} completed successfully`, { installDir: options.installDir, version: packageJson.version });
  } catch (error) {
    logger.error(`${action} failed`, { error: error instanceof Error ? error.message : String(error) });
    if (backupId) {
      logger.warn('Rolling back to pre-upgrade backup (Step 13)', { backupId });
      try {
        backupManager.restore(backupId);
        logger.info('Rollback completed — previous version and configuration restored');
      } catch (rollbackError) {
        logger.error('Rollback itself failed — manual recovery required', { backupId, error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) });
      }
    }
    process.exitCode = 1;
  }
}

main();
