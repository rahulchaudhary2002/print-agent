import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, run } from '../common/index.js';
import type { InstallerLogger } from '../common/index.js';
import { createExecutablePackager } from './executable-packager.js';
import type { ReleasePlatform, RuntimePackage, VersionInfo } from './types.js';

/** Everything under this list is explicitly excluded even if present in the source tree (Step 4). */
const NEVER_PACKAGE = ['src', 'tests', 'installer', '.git', 'tsconfig.json', 'installer/tsconfig.json'];

function matchesHostPlatform(platform: ReleasePlatform): boolean {
  const hostPlatform: ReleasePlatform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  return platform === hostPlatform;
}

async function stageProductionNodeModules(stagingDir: string, logger: InstallerLogger): Promise<void> {
  const source = join(REPO_ROOT, 'node_modules');
  const destination = join(stagingDir, 'node_modules');
  cpSync(source, destination, { recursive: true });
  cpSync(join(REPO_ROOT, 'package.json'), join(stagingDir, 'package.json'));
  if (existsSync(join(REPO_ROOT, 'package-lock.json'))) {
    cpSync(join(REPO_ROOT, 'package-lock.json'), join(stagingDir, 'package-lock.json'));
  }

  const prune = await run('npm', ['prune', '--omit=dev'], { cwd: stagingDir });
  if (prune.code !== 0) {
    logger.warn('npm prune --omit=dev failed on the staged copy — shipping full node_modules (dev deps included) instead', {
      stderr: prune.stderr,
    });
    return;
  }
  logger.info('Pruned devDependencies from staged node_modules');
}

/**
 * Step 4 — assembles everything a running agent needs (executable, its private Node runtime,
 * production `node_modules`, config templates, default assets, generated service files,
 * LICENSE, README, version manifest) into one directory, explicitly never touching
 * `src/`, `tests/`, `installer/`, or any TypeScript source (see `NEVER_PACKAGE`).
 */
export async function buildRuntimePackage(input: {
  version: VersionInfo;
  platform: ReleasePlatform;
  stagingDir: string;
  logger: InstallerLogger;
}): Promise<RuntimePackage> {
  const { version, platform, stagingDir, logger } = input;

  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  for (const forbidden of NEVER_PACKAGE) {
    if (existsSync(join(stagingDir, forbidden))) {
      throw new Error(`Refusing to continue — staging directory unexpectedly contains "${forbidden}"`);
    }
  }

  const executablePackager = createExecutablePackager();
  const { launcher } = await executablePackager.package({
    entryPoint: join(REPO_ROOT, 'dist', 'index.js'),
    outputDir: stagingDir,
    platform,
    logger,
  });

  await stageProductionNodeModules(stagingDir, logger);

  if (matchesHostPlatform(platform)) {
    const runtimeBinDir = join(stagingDir, 'runtime', 'bin');
    mkdirSync(runtimeBinDir, { recursive: true });
    cpSync(process.execPath, join(runtimeBinDir, process.platform === 'win32' ? 'node.exe' : 'node'));
    logger.info('Bundled private Node runtime', { runtimeBinDir });
  } else {
    logger.warn(`Cannot bundle a ${platform} Node runtime while building on ${process.platform} — the launcher expects one at runtime/bin/; supply it manually when finishing this build on the target platform`);
  }

  const configTemplatesDir = join(stagingDir, 'config-templates');
  mkdirSync(configTemplatesDir, { recursive: true });
  writeFileSync(
    join(configTemplatesDir, 'config.default.json'),
    JSON.stringify(
      {
        port: 3210,
        paperWidth: '80mm',
        autoCut: true,
        loggingLevel: 'info',
        queueSize: 500,
        retryCount: 3,
      },
      null,
      2,
    ),
    'utf-8',
  );

  for (const file of ['LICENSE', 'README.md']) {
    const source = join(REPO_ROOT, file);
    if (existsSync(source)) {
      cpSync(source, join(stagingDir, file));
    }
  }

  writeFileSync(
    join(stagingDir, 'version.json'),
    JSON.stringify(
      {
        version: version.version,
        buildNumber: version.buildNumber,
        gitCommit: version.gitCommit,
        buildDate: version.buildDate,
        platform: version.platform,
        arch: version.arch,
      },
      null,
      2,
    ),
    'utf-8',
  );

  logger.info('Runtime package staged', { stagingDir, platform });
  return { dir: stagingDir, executable: launcher };
}
