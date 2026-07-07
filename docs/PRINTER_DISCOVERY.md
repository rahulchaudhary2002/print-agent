# Printer Discovery & Configuration System

Extends the existing Print Agent (`src/printer/`) with automatic hardware discovery,
capability detection, printer profiles, persisted per-printer configuration, continuous
health monitoring, and automatic recovery. It is entirely local — no network calls beyond
scanning the LAN for printers, and no dependency on the print pipeline: discovery, health
polling, and recovery all run independently of printing (Step 17), so a slow scan never
blocks a print job and a stuck queue never blocks a scan.

## Module layout

```
src/printer/
  discovery/
    types/                          DiscoveredPrinterCandidate, DiscoveryResultEntry, DiscoveryDiff
    scanners/                       usb.scanner.ts, network.scanner.ts, windows.scanner.ts,
                                     cups.scanner.ts, bluetooth.scanner.ts (placeholder)
    fingerprint.util.ts             stable dedup key shared by scanners + registered printers
    discovery-manager.service.ts    DiscoveryManager — scan, merge, diff, cache
    discovery-scheduler.service.ts  DiscoveryScheduler — startup/periodic/manual + debounce
    discovery.service.ts            (pre-existing, untouched) legacy /printers/discover sweep
  monitor/
    printer-monitor.service.ts      starts/stops discovery scheduler + health monitor together
  profiles/
    built-in-profiles.data.ts       seeded profiles (Generic ESC/POS 80mm/58mm, Epson TM-T88, ...)
    printer-profile.service.ts      PrinterProfileService — built-ins + custom (DB-backed)
  capabilities/
    capability-detector.service.ts  CapabilityDetectorService — driver + profile → snapshot
  configuration/
    printer-configuration.service.ts  PrinterConfigurationService — persisted overrides
  validation/
    printer-validation.service.ts   PrinterValidationService — pre-save checks
  cache/
    ttl-cache.util.ts               generic in-memory TTL cache
    printer-cache.service.ts        PrinterCacheService — one named cache per concern
  health/
    printer-health-monitor.service.ts  PrinterHealthMonitor — polls, persists, emits events
  recovery/
    printer-recovery-manager.service.ts  PrinterRecoveryManager — reacts to PrinterOffline
  events/
    printer-event-bus.ts            PrinterEventBus + PrinterEventType (Step 16)
```

New SQLite tables (migrations `008`–`010`): `printer_profiles`, `printer_configurations`,
`printer_health` — all additive, no existing table was altered beyond what earlier phases
already added.

## Discovery lifecycle

1. **Scan.** `DiscoveryManager.discoverAll()` fans out to five scanners in parallel — USB
   (`usb` package device list + best-effort string descriptors), Network (TCP probes across
   ports 9100/515/631, manual IP list or auto /24 sweep, records response time), Windows
   (`pdf-to-printer` installed printers + default + paper sizes), CUPS (`lpstat -e/-d/-v/-p`
   for names/default/URI/queue status), and Bluetooth (explicit no-op placeholder — no BLE
   stack is bundled). Each scanner returns a normalized `DiscoveredPrinterCandidate` with a
   structured `connection` object, ready to hand straight to `PrinterService.create()`.
2. **Merge duplicates.** Candidates sharing a `fingerprint` (e.g. two scanners finding the
   same device) are merged into one entry.
3. **Diff.** `DiscoveryManager.runScan()` compares the new candidate set against the
   previous cached set by fingerprint: unseen fingerprints are `added`, previously-seen
   fingerprints missing this time are `removed`, everything else is `unchanged`. Each
   candidate is also cross-referenced against `PrinterRepository` (via the same fingerprint
   scheme) so the API can tell "already registered" apart from "new hardware".
4. **Cache + events.** The merged/diffed result replaces the cached discovery list
   (`PrinterCacheService`) and `PrinterDiscovered`/`PrinterRemoved` events fire for each
   change (Step 16).
5. **Schedule.** `DiscoveryScheduler` runs one scan at startup, one on a configurable
   interval (default 5 minutes), and on-demand via `POST /discovery/run`. Overlapping calls
   share the same in-flight promise (never two scans running concurrently), and automatic
   triggers are debounced (default 5s) against each other — manual scans always run.

`GET /discovery` only ever reads the cache — it never touches hardware. Only
`POST /discovery/run` (or the startup/periodic timer) triggers a real sweep.

## Health lifecycle

`PrinterHealthMonitor.pollAll()` runs on a timer (default 30s), calling
`PrinterManager.getHealth(printerId)` for every **enabled** printer:

- `status` maps directly from the driver's live status (`online` / `offline` / `busy` /
  `error` / `unknown`).
- On `online`: `failureCount` resets to 0, `lastError` clears, `lastSeenAt` updates.
- On anything else: `failureCount` increments; `lastError` is kept from the driver (or the
  previous value if the driver didn't report one).
- If the status call itself throws (e.g. driver misconfigured), the printer is marked
  `unknown` with the exception message as `lastError`.

Every poll persists to `printer_health` (survives restarts) and updates the health cache.
A status **transition** (previous ≠ next) emits `HealthChanged`, plus `PrinterOnline` or
`PrinterOffline` as appropriate — `PrinterRecoveryManager` listens for the offline
transition rather than polling anything itself.

## Recovery lifecycle

`PrinterRecoveryManager` reacts to `PrinterOffline` automatically, and exposes
`POST /printers/:id/recover` for manual triggers. A `Set<printerId>` of in-flight recoveries
guarantees at most one attempt per printer at a time — a second trigger while one is running
is rejected immediately rather than queued or run in parallel.

Recovery steps, in order:
1. Emit `RecoveryStarted`.
2. `PrinterManager.reinitializeDriver(printerId)` — disconnects the existing driver instance
   (if any) and re-creates it from the printer's *current* stored connection. This is the
   fix for "temporary printer offline" and "restart driver connection".
3. Check status. If still not `online` (e.g. a network printer's IP changed), trigger a
   fresh discovery scan via `DiscoveryScheduler.runManualScan()` and check again — this is
   the "retry discovery" step, letting a later manual re-registration pick up the new address.
4. On success, `PrinterHealthMonitor.recordRecovery()` bumps `recoveryCount`.
5. Emit `RecoveryCompleted` with the outcome either way.

## Printer profile architecture

A `PrinterProfile` bundles paper width, default renderer, supported drivers, encoding, and
capability flags (image/QR/barcode/cash-drawer/cut) for a printer model. Built-in profiles
(`built-in-profiles.data.ts`) are seeded in code — shipping an agent update can safely add or
tweak them without a migration. Custom profiles are created via the API and persisted to
`printer_profiles`; built-ins are rejected from update/delete (`PrinterProfileService`
checks the id against the built-in list before touching the repository).
`PrinterProfileService.list()` merges both sets at read time.

Assigning a profile to a printer (`POST /printers/:id/profile`) doesn't copy the profile's
fields onto the printer — it stores a `profileId` reference in `printer_configurations`.
`CapabilityDetectorService` and `PrinterConfigurationService` resolve the profile at read
time, so editing a custom profile immediately affects every printer linked to it.

## Capability detection

`CapabilityDetectorService.detect(printerId)` starts from the driver's static
`capabilities: PrinterCapability[]` (via the existing `PrinterManager.getCapabilities()` —
no new hardware call), then layers the linked profile's explicit flags on top when one is
assigned. The profile wins when present, since it reflects a human-confirmed fact about that
exact hardware model (e.g. "this network printer has a cash drawer port") that a generic
driver capability list can't express. Snapshots are cached per printer and invalidated
whenever that printer's configuration changes.

## Caching strategy

`PrinterCacheService` wraps four independent `TtlCache` instances — discovery results
(60s), capability snapshots (5min, per printer), profile list (5min), and health snapshots
(15s, per printer). Each has its own TTL because they change at different rates: a health
poll happens every 30s, but a profile rarely changes. Writes are explicit (a completed scan,
a configuration update) rather than relying purely on TTL expiry, so the API never serves
data that's known to be stale — TTL is the fallback for "an external factor changed things
without telling the cache" (e.g. the driver itself reconnecting on its own).

`PrinterMonitor` sweeps expired entries out of all four caches every 60s to bound memory —
`get()` also lazily expires on read, so the sweep is a memory bound, not a correctness
requirement.

## Configuration flow

`PrinterConfiguration` is a *merged view*: core fields (`name`, `driver`, `connection`,
`enabled`, `isDefault`) already live on the `printers` table from earlier phases;
`PrinterConfigurationService` layers extended, optional overrides
(`friendlyName`, `profileId`, `preferredDriver`, `paperWidth`, `renderer`, `timeoutMs`,
`retryMax`, `retryBackoffMs`) from `printer_configurations` on top, falling back to global
`AppConfig` defaults (`printTimeoutMs`, `retryCount`) when no override is set. `.get()` never
fails for a printer with no configuration row — it just returns all defaults. `.update()`
upserts only the changed fields, persists immediately (survives restarts), invalidates that
printer's capability cache, and emits `ConfigurationChanged`.

## Validation

`PrinterValidationService.validate()` — used internally before any printer create/update,
and exposed directly via `POST /printers/:id/validate` — checks, in order: the driver is
registered in `DriverRegistry`; the `connection` object has the fields that driver actually
requires (e.g. `vendorId`/`productId` for USB, `ip` for network); no other printer already
has the same identity fingerprint; `paperWidth` is a known preset or a positive number; and,
if a `profileId` is given, that the driver is in the profile's `supportedDrivers`. It
reports every failing rule at once (not fail-fast), returning `{ valid, errors[] }` rather
than throwing, so the API can show a full validation report — `validateOrThrow()` is
available for internal callers that want it to throw a `PrinterValidationError` instead.

## Events (Step 16)

`PrinterEventBus` (mirrors the existing `PipelineEventEmitter`/`CloudEventBus` shape) carries:
`PrinterDiscovered`, `PrinterRemoved`, `PrinterOnline`, `PrinterOffline`,
`ConfigurationChanged`, `HealthChanged`, `RecoveryStarted`, `RecoveryCompleted`. Consumed
internally today (recovery manager subscribes to `PrinterOffline`); the same `emitEvent`/
`'event'` pattern used elsewhere in this codebase means a future application-facing
subscription API can be added without changing any emitter call site.

## REST API (all under `/api/v1`, localhost-only by default)

| Method | Path | Purpose |
|---|---|---|
| GET | `/discovery` | Cached discovery results (no hardware access) |
| POST | `/discovery/run` | Run a fresh scan now (optional `{ network: {...} }` body) |
| GET | `/printers/profiles` | List built-in + custom profiles |
| POST/PUT/DELETE | `/printers/profiles(/:id)` | Manage custom profiles (built-ins are read-only) |
| GET | `/printers/capabilities` | Capability snapshot for every printer |
| GET | `/printers/:id/capabilities` | Capability snapshot for one printer |
| GET | `/printers/health` | Health snapshot for every printer |
| GET | `/printers/:id/health` | Health snapshot for one printer |
| POST | `/printers/:id/profile` | Assign a profile to a printer |
| POST | `/printers/:id/recover` | Trigger a recovery attempt |
| POST | `/printers/:id/validate` | Validate a printer's current or proposed configuration |

Every endpoint is documented in Swagger UI at `/docs` alongside the rest of the Local
Management API, and follows the same `{success, message, data}` / `{success, message,
errors}` response envelope, Zod-validated request bodies, and localhost-only/rate-limited
security posture already established in that phase.
