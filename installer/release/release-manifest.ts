import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeChecksums, writeChecksumFiles } from './checksums.js';
import type { ReleaseArtifact, ReleaseManifest, ReleasePlatform, VerificationReport, VersionInfo } from './types.js';

/**
 * Step 9/10 — computes checksums for every produced artifact and writes `release-manifest.json`
 * (Step 10) summarizing the whole release: version info, every artifact with its size and both
 * checksums, when it was generated, and which platforms are actually supported by this build.
 */
export function buildReleaseManifest(input: {
  version: VersionInfo;
  artifacts: Array<{ path: string; platform: ReleasePlatform | 'portable' }>;
  checksumsDir: string;
  verification: VerificationReport[];
}): ReleaseManifest {
  const artifacts: ReleaseArtifact[] = input.artifacts.map(({ path, platform }) => {
    const checksums = computeChecksums(path);
    writeChecksumFiles(path, input.checksumsDir, checksums);
    return {
      name: path.split('/').pop() ?? path,
      path,
      platform,
      sizeBytes: checksums.sizeBytes,
      sha256: checksums.sha256,
      sha512: checksums.sha512,
    };
  });

  const supportedPlatforms = [...new Set(artifacts.map((a) => a.platform).filter((p): p is ReleasePlatform => p !== 'portable'))];

  return {
    version: input.version,
    generatedAt: new Date().toISOString(),
    supportedPlatforms,
    artifacts,
    verification: input.verification,
  };
}

export function writeReleaseManifest(manifestDir: string, manifest: ReleaseManifest): string {
  const path = join(manifestDir, 'release-manifest.json');
  writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8');
  return path;
}
