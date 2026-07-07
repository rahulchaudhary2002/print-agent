import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface ArtifactChecksums {
  sizeBytes: number;
  sha256: string;
  sha512: string;
}

/** Step 9 — SHA256 and SHA512 for a single artifact file. */
export function computeChecksums(filePath: string): ArtifactChecksums {
  const data = readFileSync(filePath);
  return {
    sizeBytes: statSync(filePath).size,
    sha256: createHash('sha256').update(data).digest('hex'),
    sha512: createHash('sha512').update(data).digest('hex'),
  };
}

/** Writes a standard `sha256sum`/`sha512sum`-compatible checksum file (`<name>.sha256`, `<name>.sha512`) next to the artifact. */
export function writeChecksumFiles(filePath: string, checksumsDir: string, checksums: ArtifactChecksums): void {
  const name = basename(filePath);
  writeFileSync(join(checksumsDir, `${name}.sha256`), `${checksums.sha256}  ${name}\n`, 'utf-8');
  writeFileSync(join(checksumsDir, `${name}.sha512`), `${checksums.sha512}  ${name}\n`, 'utf-8');
}
