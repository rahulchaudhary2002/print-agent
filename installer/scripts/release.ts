import { ReleaseManager } from '../release/index.js';
import { parseArgs, flag } from './arg-parser.js';

/**
 * Step 14 — `npm run release`. Internally runs the full pipeline (clean → build → package →
 * verify → release) as one command; CI-friendly (Step 17) — no prompts, deterministic exit code.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manager = new ReleaseManager({
    skipVerification: flag(args, 'skip-verification', false),
    skipUpgradeVerification: flag(args, 'skip-upgrade-verification', false),
  });

  const manifest = await manager.run();

  console.log(`\nRelease ${manifest.version.version} complete — ${manifest.artifacts.length} artifact(s):`);
  for (const artifact of manifest.artifacts) {
    console.log(`  [${artifact.platform}] ${artifact.name} (${(artifact.sizeBytes / 1024 / 1024).toFixed(1)} MB)`);
  }
  const failedVerifications = manifest.verification.filter((report) => !report.passed);
  if (failedVerifications.length > 0) {
    console.warn(`\n${failedVerifications.length} verification report(s) had failing checks — see release/${manifest.version.version}/logs/verification.log`);
  }
}

main().catch((error: unknown) => {
  console.error('\nRelease pipeline failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
