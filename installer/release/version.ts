import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, run } from '../common/index.js';
import type { VersionInfo } from './types.js';

/**
 * Step 7 — reads the application version from `package.json` (the single source of truth the
 * rest of the app already uses, e.g. `AppConfig.version`/`DEFAULT_CONFIG.version` — this doesn't
 * introduce a second version number, it just also exposes the same one to the release pipeline)
 * and combines it with build metadata that only exists at release time.
 */
export async function resolveVersionInfo(): Promise<VersionInfo> {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };

  const gitCommitResult = await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT });
  const gitCommit = gitCommitResult.code === 0 ? gitCommitResult.stdout.trim() : null;

  const buildNumber = process.env['BUILD_NUMBER'] ?? process.env['GITHUB_RUN_NUMBER'] ?? new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

  return {
    version: packageJson.version,
    buildNumber,
    gitCommit,
    buildDate: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
  };
}
