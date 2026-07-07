import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { BackupManifest } from './types.js';
import type { InstallerLogger } from './installer-logger.js';

/**
 * Step 13 — snapshots the files an upgrade/repair is about to touch, so a failure can restore
 * exactly what was there before. Deliberately file-level (copy config.json, the database file
 * and its WAL/SHM sidecars, and the previous `dist/`+`package.json`), not a transaction log —
 * simple enough to reason about under "installer must not contain business logic," and it's the
 * right granularity for what can actually go wrong during an install (a copy fails partway
 * through, a migration errors, the process is killed) versus what the database's own migration
 * transactions already handle internally.
 */
export class BackupManager {
  constructor(
    private readonly backupsDir: string,
    private readonly logger: InstallerLogger,
  ) {}

  create(reason: BackupManifest['reason'], fromVersion: string | null, paths: string[]): BackupManifest {
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${reason}`;
    const backupDir = join(this.backupsDir, id);
    mkdirSync(backupDir, { recursive: true });

    const backedUp: string[] = [];
    for (const sourcePath of paths) {
      if (!existsSync(sourcePath)) {
        continue;
      }
      const destination = join(backupDir, basename(sourcePath));
      cpSync(sourcePath, destination, { recursive: true });
      backedUp.push(sourcePath);
    }

    const manifest: BackupManifest = { id, createdAt: new Date().toISOString(), reason, fromVersion, files: backedUp };
    writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    this.logger.info('Created backup', { id, reason, files: backedUp.length });
    return manifest;
  }

  /** Restores every file in the backup back to its original recorded location, overwriting current state. */
  restore(id: string): void {
    const backupDir = join(this.backupsDir, id);
    const manifest = JSON.parse(readFileSync(join(backupDir, 'manifest.json'), 'utf-8')) as BackupManifest;
    for (const originalPath of manifest.files) {
      const source = join(backupDir, basename(originalPath));
      if (!existsSync(source)) {
        this.logger.warn('Backup missing expected file, skipping restore for it', { originalPath });
        continue;
      }
      rmSync(originalPath, { recursive: true, force: true });
      cpSync(source, originalPath, { recursive: true });
    }
    this.logger.info('Restored backup', { id, files: manifest.files.length });
  }

  list(): BackupManifest[] {
    if (!existsSync(this.backupsDir)) {
      return [];
    }
    return readdirSync(this.backupsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const manifestPath = join(this.backupsDir, entry.name, 'manifest.json');
        return existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf-8')) as BackupManifest) : null;
      })
      .filter((manifest): manifest is BackupManifest => manifest !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  latest(): BackupManifest | null {
    return this.list()[0] ?? null;
  }
}
