import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, run } from '../common/index.js';
import type { InstallerLogger } from '../common/index.js';
import type { UpgradeVerificationReport, VerificationCheck } from './types.js';

const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const INSTALL_SCRIPT = join(REPO_ROOT, 'installer', 'scripts', 'install.ts');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs: number, stepMs = 250): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await delay(stepMs);
  }
  return predicate();
}

/**
 * Step 12 — exercises the real upgrade path built in the installer phase (`installer/scripts/
 * install.ts`, which detects an existing install and takes the backup+preserve branch) end to
 * end in a disposable directory: install fresh with a real one-time launch (so `ConfigService`
 * actually creates `config.json`/the database the way it would on a genuine first boot — the
 * installer itself never creates `config.json`, only the app does, on `ConfigService.load()`'s
 * first-run path), stop it, mutate config, "upgrade" by re-installing over the same directory,
 * and check that config/database/printer profiles/logs all survived.
 */
export async function runUpgradeVerification(input: { workDir: string; logger: InstallerLogger }): Promise<UpgradeVerificationReport> {
  const { workDir, logger } = input;
  const checks: VerificationCheck[] = [];
  rmSync(workDir, { recursive: true, force: true });

  const configPath = join(workDir, 'storage', 'config.json');

  const first = await run(TSX_BIN, [INSTALL_SCRIPT, `--install-dir=${workDir}`, '--silent', '--dev', '--launch=true']);
  checks.push({ name: 'Fresh install succeeds', passed: first.code === 0, detail: first.code === 0 ? 'ok' : first.stderr.slice(0, 300) });

  // install.ts spawns the app detached (fire-and-forget) to actually create config.json/the
  // database the way a real first boot would, then returns immediately — wait for that.
  const booted = await waitFor(() => existsSync(configPath), 10_000);
  if (!booted) {
    logger.warn('App did not create config.json within 10s after --launch=true install');
  }
  await run('pkill', ['-TERM', '-f', join(workDir, 'dist', 'index.js')]);
  await delay(1500);

  const marker = 'upgrade-verification-marker';
  let markerWritten = false;
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    config['loggingLevel'] = 'warn';
    config[marker] = true;
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    markerWritten = true;
  }
  checks.push({ name: 'Mutate configuration before upgrade', passed: markerWritten, detail: markerWritten ? configPath : 'config.json not found after fresh install' });

  const dbPath = join(workDir, 'storage', 'print-agent.db');
  const dbExistedBeforeUpgrade = existsSync(dbPath);
  const logsDir = join(workDir, 'logs');
  const logsExistedBeforeUpgrade = existsSync(join(logsDir, 'installer.log'));

  const second = await run(TSX_BIN, [INSTALL_SCRIPT, `--install-dir=${workDir}`, '--silent', '--dev', '--launch=false']);
  checks.push({ name: 'Upgrade (re-install over existing) succeeds', passed: second.code === 0, detail: second.code === 0 ? 'ok' : second.stderr.slice(0, 300) });

  let configPreserved = false;
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    configPreserved = config['loggingLevel'] === 'warn' && config[marker] === true;
  }
  checks.push({ name: 'Configuration preserved across upgrade', passed: configPreserved, detail: configPreserved ? 'marker + loggingLevel intact' : 'config.json missing marker after upgrade' });

  const databasePreserved = dbExistedBeforeUpgrade === existsSync(dbPath) && existsSync(dbPath);
  checks.push({ name: 'Database preserved across upgrade', passed: databasePreserved, detail: existsSync(dbPath) ? dbPath : 'print-agent.db missing after upgrade' });

  // Printer profiles live inside the same SQLite database as everything else persisted by the
  // app (see docs/PRINTER_DISCOVERY.md) — the database-preserved check above already covers
  // them; this check additionally confirms the backup mechanism captured it (Step 13 of the
  // service/installer phase), by checking a backup directory was actually created.
  const backupsDir = join(workDir, 'storage', 'backups');
  const backupCreated = existsSync(backupsDir);
  checks.push({ name: 'Printer profiles preserved (via database + backup)', passed: databasePreserved && backupCreated, detail: backupCreated ? backupsDir : 'no pre-upgrade backup directory found' });

  const logsPreserved = logsExistedBeforeUpgrade === existsSync(join(logsDir, 'installer.log')) && existsSync(join(logsDir, 'installer.log'));
  checks.push({ name: 'Logs preserved across upgrade', passed: logsPreserved, detail: logsPreserved ? logsDir : 'installer.log missing after upgrade' });

  const passed = checks.every((check) => check.passed);
  logger.info('Upgrade verification complete', { passed, checks });

  return { fromVersion: 'previous-build', toVersion: 'current-build', checks, passed };
}
