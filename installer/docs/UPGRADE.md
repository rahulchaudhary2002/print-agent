# Upgrade Guide

## Running an upgrade

Upgrading is the same command as installing — the installer detects an existing installation
by checking for `<installDir>/dist/index.js` and switches its logging/behavior to "upgrade"
automatically:

```bash
npm run installer:install -- --silent --install-dir=/opt/print-agent
```

Or via the CLI: `print-agent-ctl install --install-dir=/opt/print-agent`.

## What's preserved (Step 7)

`copyApplicationFiles` only ever copies `dist/`, `package.json`, `package-lock.json`, and
`node_modules` — **`storage/`, `logs/`, and `temp/` are never in that list**, so there's nothing
in the upgrade path that can touch `config.json`, the SQLite database, printer profiles, or
existing logs even by accident. This was verified directly: a config value changed before an
upgrade (`loggingLevel: "warn"`) was confirmed unchanged after the upgrade completed.

New configuration fields introduced by a newer version don't need an explicit migration step —
`ConfigService.load()` (unchanged, from the original Local Management API phase) merges the
persisted file over `DEFAULT_CONFIG`, so a field that didn't exist in the old `config.json`
simply gets its new default the next time the app starts. This is a property of how the app
already loads its config, not something the installer does.

## What actually changes

1. **Backup created first** (Step 13) — `storage/backups/<timestamp>-upgrade/` gets a copy of
   `config.json`, the database (and its WAL/SHM sidecars if present), the previous `dist/`, and
   the previous `package.json`, plus a `manifest.json` recording what was captured and the
   previous version.
2. **Application files replaced** — new `dist/`, `package.json`, `node_modules`.
3. **Database migrations run** (Step 8) — via `dist/cli/migrate.js`; every migration is
   idempotent (tracked in `_migrations`), so running it against an already-migrated database is
   a fast no-op.
4. **Service re-registered** — the systemd unit/Scheduled Task/LaunchAgent is regenerated (in
   case the entry point path or Node version changed) and the service restarted if it was
   running before.
5. **Version manifest updated** — `installedVersion`, `schemaVersion` (migration count),
   `migrationVersion` (name of the most recently applied migration), and `updatedAt` all bump;
   `installedAt` is preserved from the original install.

## If an upgrade fails (Step 13 — recovery)

Any exception during the copy/migrate/service-registration steps triggers an automatic rollback:
the pre-upgrade backup is restored (config, database, and the previous `dist/`+`package.json`),
and the installer exits non-zero with the failure logged. The previous version is left running
exactly as it was — an upgrade failure should never leave the agent in a half-upgraded state.

To restore a backup manually:

```ts
import { BackupManager, InstallerLogger } from './installer/common/index.js';
const manager = new BackupManager('<installDir>/storage/backups', new InstallerLogger('<installDir>/logs/installer.log'));
manager.restore('<backup-id>'); // see manager.list() for available ids
```

## Downgrading

Not a distinct code path — install an older build the same way (`--install-dir` pointing at the
existing installation). The same backup/preserve/migrate logic applies; the one caveat is that
database migrations are one-directional (Step 8's migration runner has no "down" migrations), so
downgrading after a schema-changing upgrade may leave the database ahead of what the older code
expects. Restoring the pre-upgrade backup (above) is the safe way to actually reverse a schema
change, rather than installing an older build over a newer schema.
