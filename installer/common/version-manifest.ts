import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { VersionManifest } from './types.js';

/**
 * Step 15 — tracks installed version, schema version (the count of applied database
 * migrations — a reliable proxy for "migration version" without duplicating the migration
 * runner's own bookkeeping in `_migrations`), configuration version, and build number. Written
 * by the installer at install/upgrade/repair time; read by `print-agent-ctl version` and by
 * the install verification step.
 */
export function readVersionManifest(path: string): VersionManifest | null {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as VersionManifest;
}

export function writeVersionManifest(path: string, manifest: VersionManifest): void {
  writeFileSync(path, JSON.stringify(manifest, null, 2), 'utf-8');
}

export interface VersionManifestInput {
  installedVersion: string;
  schemaVersion: number;
  configVersion: number;
  migrationVersion: string | null;
  buildNumber: string;
}

export function buildVersionManifest(path: string, input: VersionManifestInput): VersionManifest {
  const now = new Date().toISOString();
  const existing = readVersionManifest(path);
  return {
    ...input,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
  };
}
