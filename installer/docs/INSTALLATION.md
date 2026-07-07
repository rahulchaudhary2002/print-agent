# Installation Guide

## What the installer does — and doesn't do

The installer (`installer/`) is a standalone orchestration layer: it creates directories, copies
already-built application files, calls the app's own migration runner as a subprocess, and
drives each OS's native service manager. It contains **no print/queue/discovery/database logic**
of its own — every check it defers to (health, migrations, service status) calls into the
already-built application rather than re-implementing anything.

## Prerequisites

- Node.js 18+ on the target machine (the installer does not bundle a Node runtime)
- Linux: `systemd` (for service registration), `dpkg-deb`/`fakeroot` (for building a `.deb`),
  optionally `rpmbuild`/`appimagetool` for the other Linux package formats
- Windows: PowerShell 5.1+ (bundled with Windows 10/11)
- macOS: `launchctl` (bundled with macOS)

## Interactive install

```bash
npm run build
npm run installer:install
```

Prompts for installation path, service name, start-automatically, desktop shortcut, and
launch-after-install. Defaults are shown in brackets — press Enter to accept.

## Silent install

```bash
npm run installer:install -- --silent --install-dir=/opt/print-agent --autostart=true
```

Flags: `--silent`, `--dev`, `--install-dir=<path>`, `--service-name=<name>`,
`--autostart=true|false`, `--desktop-shortcut=true|false`, `--launch=true|false`.

## What happens, in order

1. **Validation** (Step 9) — OS/architecture, disk space, memory, and port 3210 availability.
   A fatal issue (e.g. the port is already in use) aborts before anything is touched.
2. **Runtime directories** created: `storage/`, `logs/`, `temp/`, `storage/cache/`,
   `storage/crash-dumps/`, `storage/backups/`.
3. **Backup** (only on upgrade) — see [UPGRADE.md](UPGRADE.md).
4. **Copy application files** — `dist/`, `package.json`, `package-lock.json`, `node_modules`.
   `storage/`, `logs/`, and `temp/` are never in this list.
5. **Database migrations** — runs `dist/cli/migrate.js` as a subprocess.
6. **Service registration** — platform-specific (see below), skipped entirely with `--dev`.
7. **Version manifest** written to `storage/version.json`.
8. **Verification** (Step 16) — if the service was started, polls `/api/v1/health`,
   `/api/v1/service/status`, `/api/v1/service/workers`.

## Platform-specific service registration

### Linux — systemd

Requires root for the privileged steps (creating the `printagent` service user, copying the
unit file to `/etc/systemd/system`, `systemctl enable`). Without root, the installer generates
everything into `<installDir>/temp/systemd-staging/` and logs exactly what to run manually:

```bash
sudo cp <installDir>/temp/systemd-staging/print-agent.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now print-agent
```

### Windows — Scheduled Task

Registers a Scheduled Task (`PrintAgentService`) triggered at startup, running hidden via a
VBScript launcher. This is a deliberate, documented trade-off over a true Windows Service — see
`docs/SERVICE_MANAGEMENT.md` (from the service-management phase) for why, and `node-windows` as
the upgrade path if full SCM compliance (pause/continue) is needed later. Run
`installer:install` from an **elevated** PowerShell/terminal for registration to succeed.

### macOS — LaunchAgent

Installs a per-user LaunchAgent plist to `~/Library/LaunchAgents` and loads it with
`launchctl load -w`. No elevation needed (it's a per-user agent, not a system daemon). A `.pkg`
installer isn't produced — `pkgbuild`/`productbuild` only exist on macOS itself, so it can't be
built or verified from this project's Linux development environment. The `PlatformInstaller`
architecture is identical to Windows/Linux; only the final PKG-wrapping step is a documented gap.

## Producing installable packages

```bash
npm run installer:package
```

Builds (on Linux, with the tools present in this project's environment): a portable
`.tar.gz`, a portable `.zip`, and a real `.deb` (verified installable structure). RPM and
AppImage are staged in full and built automatically if `rpmbuild`/`appimagetool` happen to be
present; otherwise the exact command to finish the build elsewhere is logged. A Windows
installer executable and a macOS `.pkg` need their native platforms' own tooling (WiX/Inno
Setup, pkgbuild) and are not produced by this script.
