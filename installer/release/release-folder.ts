import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ReleaseFolderLayout {
  root: string;
  windows: string;
  linux: string;
  macos: string;
  portable: string;
  checksums: string;
  manifest: string;
  logs: string;
}

/** Step 8 — `release/<version>/{windows,linux,macos,portable,checksums,manifest,logs}/`, each holding only distributable artifacts. */
export function createReleaseFolder(releaseRoot: string, version: string): ReleaseFolderLayout {
  const root = join(releaseRoot, version);
  const layout: ReleaseFolderLayout = {
    root,
    windows: join(root, 'windows'),
    linux: join(root, 'linux'),
    macos: join(root, 'macos'),
    portable: join(root, 'portable'),
    checksums: join(root, 'checksums'),
    manifest: join(root, 'manifest'),
    logs: join(root, 'logs'),
  };
  for (const dir of Object.values(layout)) {
    mkdirSync(dir, { recursive: true });
  }
  return layout;
}
