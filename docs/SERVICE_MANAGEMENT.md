# Service Management

Turns the Print Agent into a production-ready background service: it starts automatically at
boot, exposes `http://127.0.0.1:3210` continuously, recovers from crashes, and supports
hot-reloading configuration without a restart. This phase adds `src/service/` on top of the
existing application — no existing module was rewritten, only extended (a handful of additive
getters/setters) and orchestrated from `index.ts`.

## Module layout

```
src/service/
  service.types.ts            ServiceStatusState, WorkerStatus, StartupReport, RecoveryPolicies
  service-event-bus.ts        ServiceEventBus + ServiceEventType (Step 16-style internal events)
  service-manager.ts          ServiceManager — Step 2's Start/Stop/Restart/Reload/Status
  startup/
    startup-sequence.service.ts   StartupSequence — times & logs each boot stage
    startup-validator.service.ts  StartupValidator — Step 12 pre-flight checks
  shutdown/
    shutdown-sequence.service.ts  ShutdownSequence — times & logs each shutdown stage
  process/
    process-info.service.ts   ProcessInfo — PID file, app uptime, stale-PID crash detection
  signals/
    signal-handler.service.ts SignalHandler — SIGINT/SIGTERM/SIGBREAK, ignores repeat signals
  watchdog/
    process-watchdog.service.ts  ProcessWatchdog — Step 6 resource monitor + Step 14 worker restart
  installer/
    installer.types.ts        InstallerContext / GeneratedFile shared types
    linux/systemd.util.ts     systemd unit + install/uninstall/manage.sh generator
    windows/windows-task.util.ts  Scheduled Task + PowerShell script generator
    macos/launchd.util.ts     LaunchAgent plist + install/uninstall/manage.sh generator
src/cli/generate-service-files.ts   writes the generated installer files to deploy/<platform>/
```

## Startup lifecycle (Step 3)

`index.ts` runs the exact same construction order it always has — this phase didn't change
*what* gets built, only wrapped each stage in `StartupSequence.run(name, fn)` for timing:

```
Load Configuration → Initialize Logger → Startup Validation → Initialize Database →
Run Migrations → Initialize Drivers → Load Printers → Initialize Queue →
Start Queue Worker → Start Discovery Scheduler → Start Health Monitor →
Start REST API → Ready
```

"Load Configuration" happens before a `LoggerService` exists, so its duration is measured with
`process.hrtime.bigint()` directly and recorded into the report retroactively
(`StartupSequence.recordExternal`) once the logger is available. Every other stage is timed
automatically by `run()`, which also logs a start/completion line and re-throws on failure after
recording it. The full report — every stage's name, duration, and success — is available at
`GET /service/startup` and was captured live in testing (`totalDurationMs: 7450` in one run,
dominated by the discovery scheduler's first USB/network sweep).

**Startup Validation (Step 12)** runs right after the logger exists, before anything expensive:
storage/logs/temp directories must be writable (created if missing), and the configured port
must be free (`StartupValidator` briefly binds and releases it). A fatal issue here aborts boot
with a clear log line and `process.exitCode = 1` — verified live: starting a second instance
while the first is running logs `Port 3210 is already in use...` and exits non-zero without
touching the database at all. After printers load, a second, non-fatal check
(`validatePrinters`) warns about any printer referencing a driver that isn't registered.

## Shutdown lifecycle (Step 4)

`SignalHandler` registers `SIGINT`, `SIGTERM`, and `SIGBREAK` (Node silently ignores a
`SIGBREAK` listener on non-Windows platforms, so registering all three unconditionally is safe
everywhere) and ignores a second signal while already shutting down. Each triggers
`ServiceManager.gracefulShutdown()`, which runs `ShutdownSequence` through the exact flow from
the spec:

```
Stop accepting new jobs → Finish active print → Persist queue state →
Close driver connections → Stop schedulers → Close REST API →
Close database → Flush logs → Exit
```

"Persist queue state" doesn't need to *do* anything to survive a restart — every job's status
is already written to SQLite on every transition, not batched — so this stage just logs the
current in-memory queue depth for visibility. "Close driver connections" calls a new additive
`PrinterManager.disconnectAll()`. Every stage is individually timed and logged, and a stage
throwing doesn't abort the rest — shutdown gets as far as it can rather than abandoning cleanup
because one step failed. Verified live: a `SIGTERM` produced all eight stages in the log with a
`totalDurationMs: 107` summary line, and the PID file was removed only on this clean path.

A bounded overall timer (`AppConfig`'s `shutdownTimeoutMs`, unchanged from the print pipeline
phase) forces `process.exit(1)` if the whole sequence hangs.

## Crash recovery (Step 5)

Two independent signals detect an unclean previous exit, checked once at the very start of
`main()`:

1. **Crash marker** — `ProcessWatchdog`'s fatal-error handler (see below) writes
   `storage/crash.marker` with the error kind/message before exiting. If present at the next
   boot, it's read, logged, and deleted.
2. **Stale PID file** — `ProcessInfo` writes `storage/print-agent.pid` immediately at startup
   and only removes it in the graceful shutdown sequence. If a PID file is already present at
   boot, the previous process never reached that stage — crash, `kill -9`, or a power loss all
   look identical from this check, which is the correct behavior (there's no way to distinguish
   them after the fact, and the recovery action is the same either way).

Either signal sets `recoveredFromCrash: true` on `ServiceManager`, visible at `GET
/service/status`. Verified live: `kill -9` on a running instance, then restarting, logged
`"Recovered from an unexpected previous shutdown"` and reported `recoveredFromCrash: true`.

**Avoiding duplicate printing** is handled by the existing (unmodified) `JobService.recoverPendingJobs()`,
called during the "Initialize Queue" stage exactly as before this phase: jobs caught mid-render/mid-print
are reset to `queued` (never re-marked `completed`), and jobs already `completed` or `failed` are
left alone — a crash mid-print can result in a job being sent to the printer twice in the worst
case (the pipeline has no way to know a partially-sent job's bytes reached the printer), but never
in a job being silently dropped or double-completed in the database.

## Worker lifecycle & the watchdog (Steps 6, 8, 14)

Four things are tracked as **managed workers**: `queue-worker`, `discovery-scheduler`,
`health-monitor`, and `rest-api`. Each is registered with `ServiceManager.registerWorker()` as a
`{ name, start, stop, isRunning }` triple — `ServiceManager` doesn't implement worker lifecycle
itself, it delegates to `ProcessWatchdog`, which is the single place both automatic and manual
restarts happen:

- **`GET /service/workers`** reports each worker's live `isRunning()` plus a running
  `restartCount`/`lastRestartAt`/`lastError`.
- **`POST /service/restart`** restarts every registered worker on demand — verified live,
  `restartCount` incremented from 0 to 1 for all four workers in one call.
- **Automatic restart**: every 30s (configurable), the watchdog checks `isRunning()` for each
  worker and restarts any that report themselves stopped, gated by `RecoveryPolicies.workerRestart`
  (Step 14 — each policy, e.g. `discoveryRestart`, `healthMonitorRestart`, is an independent
  boolean `ServiceManager.setRecoveryPolicies()` can toggle).
- **Resource monitoring** (Step 6): the same tick checks `process.memoryUsage()`/`process.cpuUsage()`
  against configurable thresholds and logs + emits `ResourceThresholdExceeded` if exceeded — this
  only warns, it doesn't restart anything on its own (a memory spike isn't necessarily fixed by
  restarting a worker, and guessing wrong risks a restart loop).
- **Unhandled exceptions/rejections**: rather than attempt to keep running in an unknown state
  (Node's own guidance), the watchdog logs the error, emits an event, writes the crash marker
  described above, runs the *same* `ShutdownSequence` used for a clean signal, and exits `1`.
  The OS service manager (systemd `Restart=on-failure`, the Scheduled Task's next boot, or
  launchd's `KeepAlive`) is what actually brings the process back — this is the standard
  "crash-only software" pattern, and it's why every platform's install script configures
  auto-restart at the process level, not just relying on the in-app watchdog.

The `rest-api` worker's `start()` is intentionally a no-op that only logs a warning: rebuilding
a Fastify instance in-place after `close()` isn't supported by Fastify, and a full API restart
in practice only matters after a config/code change, which already goes through the OS-level
process restart. This is a known, documented limitation rather than a fragile rebuild attempt.

## Configuration reload (Step 7)

`ServiceManager.reload()` (triggered by `POST /service/reload`, or automatically by an
`fs.watch` on `storage/config.json` with a 300ms debounce) re-reads the config file and applies
every hot-reloadable setting without a restart: logging level (`LoggerService.setLevel`, a live
pino property), retry count (`QueueWorker.setMaxRetries`), queue size cap
(`JobService.setMaxQueueSize`, a new additive enforcement — `AppConfig.queueSize` was previously
unenforced), and discovery interval (`DiscoveryScheduler.setIntervalMs`, which tears down and
re-arms its timer). Paper width / auto-cut / renderer settings need no explicit propagation —
they're already read fresh from `ConfigService` or the printer's own `connection` object on every
job, never cached.

**A real bug was found and fixed while verifying this**: the reload diff was comparing
`ConfigService`'s current in-memory value to itself, because `PUT /config` already mutates that
same in-memory object directly (for the HTTP response) before the file-watcher's debounced
callback ever runs — so "before" and "after" were identical and no setting ever actually
propagated. The fix tracks a separate `lastAppliedConfig` snapshot in `index.ts`, updated only
when a setting is actually applied, so the diff is meaningful regardless of what triggered the
reload (manual API call, automatic file watch, or a future config source). Verified live:
`PUT /config {loggingLevel: "error"}` followed by further requests produced zero new log lines
until reset back to `"info"`.

## Service status API (Steps 8, 13, 15)

All under `/api/v1`, alongside the rest of the Local Management API, documented in Swagger:

| Method | Path | Returns |
|---|---|---|
| GET | `/service/status` | `status` (`starting`\|`running`\|`stopping`\|`stopped`\|`recovering`\|`error`), PID, version, app/service uptime, `recoveredFromCrash` |
| POST | `/service/restart` | Restarts every managed worker; the process itself keeps running |
| POST | `/service/reload` | Re-reads config from disk, applies hot-reloadable settings |
| GET | `/service/workers` | Per-worker status, restart count, last error |
| GET | `/service/startup` | The full staged startup report from the last boot |
| GET | `/service/uptime` | App uptime (`process.uptime()`) vs. service uptime (since reaching `running`) |

"Application uptime" and "service uptime" are deliberately distinct: app uptime is `process.uptime()`
(resets only on an actual process restart); service uptime resets whenever `ServiceManager`
transitions back to `running` (currently only at boot — `POST /service/restart` restarts workers,
not the whole service state machine, so it doesn't reset service uptime).

## Packaging layout (Step 17)

Already established by earlier phases and extended, not restructured, here:

```
<project root>/        Application code (dist/, src/, package.json) — safe to overwrite on update
  storage/              Configuration (config.json), database (print-agent.db), PID file, crash marker
  logs/                 Rotation-free append logs (app.log + per-platform service logs)
  temp/                 New in this phase — scratch space for anything that needs a real file
                         but shouldn't live in storage/ or logs/ (nothing uses it yet; created and
                         validated at startup so future features have it ready)
  deploy/               Generated installer artifacts (git-ignorable, regenerate with `npm run service:generate`)
```

A future update that replaces everything under the project root except `storage/` never touches
user configuration, the database, or logs — exactly Step 17's requirement.

## OS service integration (Steps 9, 10, 11)

Run `npm run build && npm run service:generate` to write platform-specific installers into
`deploy/<platform>/`. Nothing is installed automatically — every script needs to be reviewed
and most need elevated privileges.

### Linux — systemd (`deploy/linux/`)

A real systemd unit running under a dedicated, unprivileged `printagent` user (created by
`install.sh` if it doesn't exist), with `Restart=on-failure` as the process-level complement to
the in-app watchdog. `install.sh`/`uninstall.sh` need root; `manage.sh {start|stop|restart|status}`
wraps `systemctl`. This is the platform tested most thoroughly in this phase (developed and run
on Linux) — startup, shutdown, crash recovery, and reload were all verified against the real
compiled binary, just not through `systemctl` itself in this sandboxed environment.

### Windows — Scheduled Task (`deploy/windows/`)

A true Windows Service must implement the Service Control Handler protocol (respond to SCM
start/stop/pause control codes) — a plain `node.exe` process doesn't, and wrapping it properly
needs a native shim (e.g. the `node-windows` package, which downloads/builds a helper binary at
install time). That's real OS integration this Linux-developed agent can't build *or verify*
here. Instead, `install-service.ps1` registers a Scheduled Task triggered `AtStartup`, running
the process hidden via a small VBScript launcher (`run-hidden.vbs`) — satisfying the actual
requirement (starts at boot, no visible console window, no manual launch) without an
unverifiable native dependency. `stop-service.ps1` locates the process by matching its command
line (Windows has no POSIX-signal equivalent for a headless process) and terminates it.
**If full SCM compliance (pause/continue, SCM-driven graceful stop) is needed later, `node-windows`
is the documented upgrade path** — this pragmatic approach is the same trade-off the spec
explicitly allows for macOS ("minimal implementation, but architecture should support it"),
applied here for the same honest reason: it can't be verified without a Windows machine.

### macOS — LaunchAgent (`deploy/macos/`)

A per-user LaunchAgent plist (simpler and permission-safer than a LaunchDaemon, and sufficient
since this agent talks to user-session printers) with `RunAtLoad`/`KeepAlive` covering both
"start at boot" and "restart on crash", the same way systemd's `Restart=on-failure` does.
`install.sh`/`uninstall.sh` copy the plist to `~/Library/LaunchAgents` and
`launchctl load`/`unload` it; `manage.sh` wraps `launchctl start`/`stop`/`list`. As with Windows,
this was written to be correct by inspection, not run against a real macOS machine.

## Testing performed (Step 18)

Verified against the actual compiled agent in this environment:

| Scenario | Result |
|---|---|
| Normal boot | All 11 stages reported with real durations; `GET /service/startup` matches the log |
| `SIGTERM` | Full 8-stage shutdown sequence logged; PID file removed only on this path |
| `kill -9` (crash) | Next boot detects the stale PID file, logs recovery, `recoveredFromCrash: true` |
| Config reload via `PUT /config` | Log level change took effect live (verified zero new log lines while suppressed) |
| `POST /service/restart` | All four workers' `restartCount` incremented |
| Port already in use | Second instance logs a clear fatal error and exits `1` before touching the database |

Not exercisable in this sandboxed, single-machine, Linux-only environment: real power
interruption (approximated by `kill -9`, which produces the same "no clean shutdown" signal),
an actual system reboot with the installed service starting automatically, printer disconnect
specifically *during* shutdown (the disconnect-all step is generic and unconditional, not
printer-state-aware), and a genuinely concurrent database-locked scenario (better-sqlite3's
WAL mode already used since the SQLite persistence phase makes this unlikely but wasn't
specifically forced).
