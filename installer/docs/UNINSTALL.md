# Uninstall Guide

## Running an uninstall

```bash
npm run installer:uninstall -- --install-dir=/opt/print-agent
```

Or: `print-agent-ctl uninstall --install-dir=/opt/print-agent`.

Interactive by default — you'll be asked whether to also delete configuration, the database,
and logs. Pass `--purge` to skip the prompt and delete them, or `--silent` (without `--purge`)
to skip the prompt and **preserve** them (the safe default for unattended uninstalls).

## What always happens

1. Service stopped (via `systemctl`/Scheduled Task/`launchctl`, whichever applies).
2. Service unregistered (systemd unit removed, Scheduled Task unregistered, LaunchAgent
   unloaded — each of these needs the same privilege level installation did; without it, the
   installer logs exactly what to run manually rather than failing silently).
3. `temp/` removed unconditionally — it's disposable scratch space by definition.
4. Application binaries removed unconditionally — `dist/` and `node_modules`.
   `package.json`/`package-lock.json` are left behind (a few KB of metadata, harmless).

## What's conditional — `--purge`

| | Default (no `--purge`) | With `--purge` |
|---|---|---|
| `storage/` (config, database, backups, version manifest) | Preserved | Deleted |
| `logs/` | Preserved | Deleted |

Reinstalling later without `--purge` having been used picks up exactly where you left off —
same configuration, same printers, same job history.

## Note on logs during a purge

The installer's own log file lives at `<installDir>/logs/installer.log`. Purging `logs/` deletes
it along with everything else, but the very next log line the uninstaller writes (confirming the
purge itself, and the final "Uninstall completed" line) recreates a near-empty `logs/` directory
containing just those two lines. This is intentional — a purge should still leave a receipt that
it happened — not a sign the purge didn't work; `storage/` and every other log line are gone.
