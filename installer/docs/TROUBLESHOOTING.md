# Troubleshooting Guide

## "Port 3210 is already in use"

Startup validation refuses to proceed if anything is already bound to the configured port —
including a previous instance of the agent that didn't shut down cleanly. Find and stop it:

```bash
# Linux/macOS
lsof -i :3210          # or: ss -ltnp | grep 3210
kill -TERM <pid>        # graceful — triggers the app's own shutdown sequence

# Windows
Get-NetTCPConnection -LocalPort 3210 | Select-Object OwningProcess
Stop-Process -Id <pid>
```

## "Cannot write to required directory"

The installer needs write access to the install directory (and its `storage`/`logs`/`temp`
subdirectories) *before* copying anything. On Linux, installing to a system path like
`/opt/print-agent` needs root for the initial directory creation — either run the installer with
`sudo`, or install to a user-writable path and use `--install-dir` to point at it.

## Service registration warned instead of completing ("Not running as root...")

Expected, not a failure — the installer never silently attempts a privileged action it can't
complete. It generates every file needed (systemd unit, Scheduled Task scripts, LaunchAgent
plist) into `<installDir>/temp/`, and logs the exact command to finish registration with the
right privileges. Re-run the logged command, or re-run the installer itself with elevated
privileges (`sudo` / an Administrator PowerShell).

## Upgrade failed and rolled back

Check `<installDir>/logs/installer.log` for the actual error — it's logged immediately before
the rollback message. The previous version's `dist/`, `package.json`, `config.json`, and
database are restored automatically; nothing further to do unless the underlying cause (e.g. a
disk-full condition) needs fixing before retrying.

## Database appears locked / migration hangs

`better-sqlite3` runs in WAL mode; a lock generally means another process (the currently-running
service, or a leftover instance) still has the database open. Stop the service first
(`print-agent-ctl stop`), confirm no `node dist/index.js` process is still running, then retry.

## Verifying an installation manually

The installer's own post-install check (Step 16) only polls three endpoints — for a fuller
picture:

```bash
print-agent-ctl status    # OS service state + REST API /service/status
print-agent-ctl health    # GET /api/v1/health — DB, queue, driver, disk, memory
curl http://127.0.0.1:3210/api/v1/service/workers   # per-worker status + restart counts
```

## Windows: Scheduled Task registered but the agent isn't running

Scheduled Tasks triggered `AtStartup` only actually start at the next boot (or via
`Start-ScheduledTask -TaskName PrintAgentService` immediately). If it still isn't running,
check the task's last run result: `Get-ScheduledTaskInfo -TaskName PrintAgentService`. A common
cause is Node not being on the `SYSTEM` account's `PATH` — the generated task invokes Node via
its absolute path captured at install time, so reinstalling after moving/upgrading Node
resolves this.

## Where to look next

- `<installDir>/logs/installer.log` — every install/upgrade/repair/uninstall/rollback action,
  in order, with timestamps.
- `<installDir>/logs/app.log` — the application's own structured log (see
  `docs/SERVICE_MANAGEMENT.md` at the repo root for its startup/shutdown stage logging).
- `<installDir>/storage/version.json` — installed/schema/config/migration versions, useful for
  confirming exactly what's actually running.
