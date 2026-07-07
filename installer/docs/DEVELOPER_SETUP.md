# Developer Setup Guide

## Quick start (no installer needed)

```bash
npm install
npm run dev          # tsx watch src/index.ts — hot-reloads on save
```

This is the fastest inner loop for contributors — it's exactly `npm run dev` from every earlier
phase, unaffected by anything in this one.

## Verbose logging

Set `loggingLevel` to `debug` in `storage/config.json` (or `PUT /api/v1/config` once running),
or start fresh with:

```bash
npm run installer:install -- --dev --install-dir=. --launch=false
```

then edit `storage/config.json` before starting — `--dev` mode never registers a service, so
this is safe to run directly against your working checkout.

## Testing the installer itself

The installer has its own strict-mode TypeScript project (`installer/tsconfig.json`, checked
via `npm run typecheck:installer`) so its types are verified independent of `src/`. To exercise
it without touching your real checkout, always pass `--install-dir` pointing somewhere disposable:

```bash
npm run build
npx tsx installer/scripts/install.ts --install-dir=/tmp/print-agent-test --silent --dev
npx tsx installer/scripts/uninstall.ts --install-dir=/tmp/print-agent-test --purge
```

Never run `installer:install`/`installer:uninstall` against your real checkout unless you
specifically want to test the systemd/Scheduled Task/LaunchAgent registration path — those steps
shell out to real OS commands (`systemctl`, `useradd`, `launchctl`, PowerShell).

## Project layout relevant to contributors

- `src/` — the application; see `docs/` at the repo root for feature-level documentation
  (API, printer discovery, service management).
- `installer/` — this module; `installer/common/` has no dependency on `src/` business logic
  beyond `src/utils/paths.util.ts` (pure path constants) and `src/service/installer/` (the
  systemd/Scheduled-Task/LaunchAgent *content* generators, reused rather than duplicated).
- `bin/print-agent-ctl` — a thin shim that execs `installer/scripts/cli.ts` via the local `tsx`.

## Running the test matrix locally

There's no automated test suite in this project (verification throughout has been live,
manual runs against the real compiled agent — see `installer/docs/TROUBLESHOOTING.md` and this
phase's own verification notes for what was actually exercised). If you're adding installer
behavior, the pattern to follow is the same: build, install into a throwaway `--install-dir`,
exercise the HTTP API or CLI, then uninstall with `--purge`.
