import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAppImage, buildDebPackage, buildRpmPackage } from '../linux/index.js';
import { InstallerLogger, REPO_ROOT, run, commandExists } from '../common/index.js';

/**
 * Step 14 — produces release artifacts. Always builds what's achievable with tools already on
 * this machine (a portable .tar.gz and .zip, plus a real .deb since `dpkg-deb` is present); RPM
 * and AppImage are staged and built if `rpmbuild`/`appimagetool` happen to be present, otherwise
 * left staged with a logged instruction for finishing the build elsewhere. A Windows installer
 * executable and a macOS .pkg need their native platform's own tools (WiX/Inno Setup,
 * pkgbuild) and are not attempted here — see installer/docs/INSTALLATION.md.
 */
async function main(): Promise<void> {
  const logger = new InstallerLogger(join(REPO_ROOT, 'logs', 'installer.log'));
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };
  const version = packageJson.version;
  const releaseDir = join(REPO_ROOT, 'release', version);
  mkdirSync(releaseDir, { recursive: true });

  logger.info('Building application (tsc)...');
  const buildResult = await run('npm', ['run', 'build'], { cwd: REPO_ROOT });
  if (buildResult.code !== 0) {
    logger.error('Build failed, aborting packaging', { stderr: buildResult.stderr });
    process.exitCode = 1;
    return;
  }

  const artifacts: string[] = [];

  // Portable archives — the same payload every platform's package wraps, made available directly
  // for anyone who wants to skip installation entirely (Step 17 developer/portable mode).
  const stagingDir = join(REPO_ROOT, 'temp', 'release-staging', `print-agent-${version}`);
  mkdirSync(stagingDir, { recursive: true });
  for (const entry of ['dist', 'package.json', 'package-lock.json', 'node_modules']) {
    const source = join(REPO_ROOT, entry);
    if (existsSync(source)) {
      await run('cp', ['-r', source, join(stagingDir, entry)]);
    }
  }
  writeFileSync(
    join(stagingDir, 'README.txt'),
    'Portable Print Agent build.\n\nRun: node dist/index.js\nOr install as a service: node dist/cli/generate-service-files.js (see docs/SERVICE_MANAGEMENT.md)\n',
  );

  const tarPath = join(releaseDir, `print-agent-${version}-portable.tar.gz`);
  const tarResult = await run('tar', ['-czf', tarPath, '-C', join(stagingDir, '..'), `print-agent-${version}`]);
  if (tarResult.code === 0) {
    artifacts.push(tarPath);
    logger.info('Built portable tar.gz', { tarPath });
  }

  if (await commandExists('zip')) {
    const zipPath = join(releaseDir, `print-agent-${version}-portable.zip`);
    const zipResult = await run('zip', ['-r', '-q', zipPath, `print-agent-${version}`], { cwd: join(stagingDir, '..') });
    if (zipResult.code === 0) {
      artifacts.push(zipPath);
      logger.info('Built portable zip (Windows target)', { zipPath });
    }
  }

  if (process.platform === 'linux') {
    const debPath = await buildDebPackage({ projectRoot: REPO_ROOT, version, outputDir: releaseDir, logger });
    if (debPath) artifacts.push(debPath);

    const rpmResult = await buildRpmPackage({ projectRoot: REPO_ROOT, version, outputDir: releaseDir, logger });
    if (rpmResult) artifacts.push(rpmResult);

    const appImageResult = await buildAppImage({ projectRoot: REPO_ROOT, version, outputDir: releaseDir, logger });
    if (appImageResult) artifacts.push(appImageResult);
  } else {
    logger.info('Skipping .deb/.rpm/.AppImage — only produced when packaging runs on Linux');
  }

  logger.warn('Windows installer (.exe/.msi) and macOS .pkg require their native platform\'s tooling (WiX/Inno Setup, pkgbuild) — not built here. See installer/docs/INSTALLATION.md.');

  writeFileSync(
    join(releaseDir, 'build-info.json'),
    JSON.stringify({ version, builtAt: new Date().toISOString(), platform: process.platform, arch: process.arch, artifacts }, null, 2),
  );

  logger.info('Packaging complete', { releaseDir, artifactCount: artifacts.length });
  for (const artifact of artifacts) {
    console.log(` - ${artifact}`);
  }
}

main().catch((error: unknown) => {
  console.error('Packaging failed', error);
  process.exitCode = 1;
});
