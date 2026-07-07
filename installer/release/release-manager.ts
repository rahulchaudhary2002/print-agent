import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '../../src/config/index.js';
import { REPO_ROOT, run } from '../common/index.js';
import { buildAppImage, buildDebPackage, buildRpmPackage } from '../linux/index.js';
import { buildWindowsInstaller } from '../windows/index.js';
import { cleanTemporaryDirectories, describeFailure, prepareReleaseFolderBackup } from './error-recovery.js';
import { portableOutputName, buildPortablePackage } from './portable-packager.js';
import { createReleaseFolder } from './release-folder.js';
import { createReleaseLoggers, type ReleaseLoggers } from './release-logger.js';
import { buildReleaseManifest, writeReleaseManifest } from './release-manifest.js';
import { buildRuntimePackage } from './runtime-packager.js';
import { runUpgradeVerification } from './upgrade-verification.js';
import { resolveVersionInfo } from './version.js';
import { verifyRuntimePackage, verifyServiceLifecycle } from './verification.js';
import type { PipelineStageResult, ReleaseManifest, ReleaseOptions, ReleasePlatform, VerificationReport } from './types.js';

/**
 * Step 1 — coordinates the entire release process end to end: Clean → Compile TypeScript →
 * Build Print Agent → Package Runtime → Generate Executable → Generate Installers → Generate
 * Release Folder → Generate Checksums → Generate Build Manifest, plus verification (Step 11/12).
 * Every stage's timing/success/failure is recorded so `npm run release` produces one clear,
 * actionable report regardless of where (if anywhere) it fails — see `error-recovery.ts`.
 */
export class ReleaseManager {
  private readonly stages: PipelineStageResult[] = [];

  constructor(private readonly options: ReleaseOptions = {}) {}

  private async runStage<T>(name: string, logger: import('../common/index.js').InstallerLogger, fn: () => Promise<T>): Promise<T> {
    const startedAt = process.hrtime.bigint();
    logger.info(`Stage starting: ${name}`);
    try {
      const result = await fn();
      const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      this.stages.push({ stage: name, durationMs, success: true });
      logger.info(`Stage completed: ${name}`, { durationMs });
      return result;
    } catch (error) {
      const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      const message = error instanceof Error ? error.message : String(error);
      this.stages.push({ stage: name, durationMs, success: false, error: message });
      logger.error(`Stage failed: ${name}`, { durationMs, error: message });
      throw error;
    }
  }

  async run(): Promise<ReleaseManifest> {
    const version = await resolveVersionInfo();
    const releaseRoot = join(REPO_ROOT, 'release');
    const layout = createReleaseFolder(releaseRoot, version.version);
    const loggers = createReleaseLoggers(layout.logs);

    const backup = prepareReleaseFolderBackup(layout.root, loggers.release);
    // prepareReleaseFolderBackup renamed the folder we just created via createReleaseFolder above
    // (matching an in-progress re-run) — recreate the empty layout now that it's safely backed up.
    if (backup.backupPath) {
      createReleaseFolder(releaseRoot, version.version);
    }

    const tempDirs: string[] = [];
    try {
      const manifest = await this.runPipeline(version, layout, loggers, tempDirs);
      backup.commit();
      return manifest;
    } catch (error) {
      loggers.release.error(describeFailure(this.stages.at(-1)?.stage ?? 'unknown', error));
      backup.rollback();
      throw error;
    } finally {
      cleanTemporaryDirectories(tempDirs, loggers.release);
    }
  }

  private async runPipeline(
    version: Awaited<ReturnType<typeof resolveVersionInfo>>,
    layout: ReturnType<typeof createReleaseFolder>,
    loggers: ReleaseLoggers,
    tempDirs: string[],
  ): Promise<ReleaseManifest> {
    // ---- Clean ----
    await this.runStage('Clean', loggers.build, async () => {
      rmSync(join(REPO_ROOT, 'dist'), { recursive: true, force: true });
      rmSync(join(REPO_ROOT, 'temp'), { recursive: true, force: true });
    });

    // ---- Compile TypeScript ----
    await this.runStage('Compile TypeScript', loggers.build, async () => {
      const result = await run('npm', ['run', 'build'], { cwd: REPO_ROOT });
      if (result.code !== 0) {
        throw new Error(result.stderr || result.stdout);
      }
    });

    // ---- Build Print Agent ----
    await this.runStage('Build Print Agent', loggers.build, async () => {
      const entryPoint = join(REPO_ROOT, 'dist', 'index.js');
      if (!existsSync(entryPoint)) {
        throw new Error(`Expected ${entryPoint} to exist after compilation`);
      }
    });

    const hostPlatform: ReleasePlatform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';

    // ---- Package Runtime + Generate Executable (Steps 3/4) ----
    const runtimeDir = join(layout.root, '_staging', `runtime-${hostPlatform}`);
    tempDirs.push(join(layout.root, '_staging'));
    const runtimePackage = await this.runStage('Generate Executable', loggers.build, () =>
      buildRuntimePackage({ version, platform: hostPlatform, stagingDir: runtimeDir, logger: loggers.build }),
    );

    // ---- Generate Installers (Steps 5/6) ----
    const artifacts: Array<{ path: string; platform: ReleasePlatform | 'portable' }> = [];

    await this.runStage('Generate Installers', loggers.installer, async () => {
      const licensePath = join(REPO_ROOT, 'LICENSE');
      const readmePath = join(REPO_ROOT, 'README.md');
      const versionJsonPath = join(layout.manifest, 'version.json');
      writeFileSync(versionJsonPath, JSON.stringify(version, null, 2), 'utf-8');

      const extraFiles = [
        ...(existsSync(licensePath) ? [{ source: licensePath, destRelative: 'LICENSE' }] : []),
        ...(existsSync(readmePath) ? [{ source: readmePath, destRelative: 'README.md' }] : []),
        { source: versionJsonPath, destRelative: 'version.json' },
      ];

      if (hostPlatform === 'linux') {
        const debPath = await buildDebPackage({ projectRoot: REPO_ROOT, version: version.version, outputDir: layout.linux, logger: loggers.installer, extraFiles });
        if (debPath) artifacts.push({ path: debPath, platform: 'linux' });

        const rpmResult = await buildRpmPackage({ projectRoot: REPO_ROOT, version: version.version, outputDir: layout.linux, logger: loggers.installer, extraFiles });
        if (rpmResult) artifacts.push({ path: rpmResult, platform: 'linux' });

        const appImagePath = await buildAppImage({ projectRoot: REPO_ROOT, version: version.version, outputDir: layout.linux, logger: loggers.installer, extraFiles });
        if (appImagePath) artifacts.push({ path: appImagePath, platform: 'linux' });
      }

      const windowsInstallerPath = await buildWindowsInstaller({
        runtimeDir: hostPlatform === 'windows' ? runtimePackage.dir : join(layout.root, '_staging', 'runtime-windows-stub'),
        version: version.version,
        outputDir: layout.windows,
        logger: loggers.installer,
      });
      if (windowsInstallerPath) artifacts.push({ path: windowsInstallerPath, platform: 'windows' });

      loggers.installer.warn('macOS .pkg not attempted — not in this phase\'s required outputs, and unbuildable/unverifiable from this Linux environment.');
    });

    // ---- Portable Package (Step 13) ----
    await this.runStage('Portable Package', loggers.installer, async () => {
      const portablePath = join(layout.portable, portableOutputName(version.version));
      const result = await buildPortablePackage({ runtimeDir: runtimePackage.dir, outputPath: portablePath, logger: loggers.installer });
      if (result) artifacts.push({ path: result, platform: 'portable' });
    });

    // ---- Verification (Step 11) ----
    const verificationReports: VerificationReport[] = [];
    if (!this.options.skipVerification && runtimePackage.executable.built && hostPlatform === 'linux') {
      const report = await this.runStage('Verification', loggers.verification, () =>
        verifyRuntimePackage({ launcherPath: runtimePackage.executable.path, port: DEFAULT_CONFIG.port, logger: loggers.verification }),
      );
      verificationReports.push(report);

      const serviceCheck = await verifyServiceLifecycle({ installDir: runtimePackage.dir, logger: loggers.verification });
      report.checks.push(serviceCheck);
      report.passed = report.passed && serviceCheck.passed;
    }

    // ---- Upgrade Verification (Step 12) ----
    if (!this.options.skipUpgradeVerification) {
      await this.runStage('Upgrade Verification', loggers.verification, async () => {
        const workDir = join(layout.root, '_staging', 'upgrade-verification');
        tempDirs.push(workDir);
        const report = await runUpgradeVerification({ workDir, logger: loggers.verification });
        if (!report.passed) {
          loggers.verification.warn('Upgrade verification reported failures', { checks: report.checks.filter((c) => !c.passed) });
        }
      });
    }

    // ---- Generate Checksums + Build Manifest (Steps 9/10) ----
    const manifest = await this.runStage('Generate Build Manifest', loggers.release, async () =>
      buildReleaseManifest({ version, artifacts, checksumsDir: layout.checksums, verification: verificationReports }),
    );
    writeReleaseManifest(layout.manifest, manifest);
    writeFileSync(join(layout.root, 'version.json'), JSON.stringify(version, null, 2), 'utf-8');

    loggers.release.info('Release pipeline completed', {
      version: version.version,
      artifactCount: artifacts.length,
      stages: this.stages.length,
    });

    return manifest;
  }

  getStageResults(): PipelineStageResult[] {
    return [...this.stages];
  }
}
