# Portable Mode Guide

Portable mode runs the Print Agent without installing anything as a service — no systemd unit,
no Scheduled Task, no LaunchAgent, no elevated privileges required. Useful for trying the agent
out, running it from a USB drive, or any scenario where a background service isn't wanted.

## Running portably

The plain, already-existing way (no installer involved at all):

```bash
npm run build
node dist/index.js
```

Or from a released portable archive (`print-agent-<version>-portable.tar.gz`/`.zip` from
`npm run installer:package`):

```bash
tar -xzf print-agent-1.0.0-portable.tar.gz
cd print-agent-1.0.0
node dist/index.js
```

Both create `storage/`, `logs/`, and `temp/` relative to wherever `dist/index.js` is run from —
identical layout to an installed deployment, just not registered with the OS.

## Using the installer in portable/dev mode

`--dev` skips service registration but still runs every other step (validation, directory
setup, migrations, version manifest) — useful for setting up a portable copy with the installer's
safety checks intact rather than running the app raw:

```bash
npm run installer:install -- --dev --install-dir=/path/to/anywhere --launch=true
```

`--launch=true` spawns the agent detached after setup finishes, so the command returns
immediately with the agent already running in the background — stop it the normal way
(`Ctrl+C` if run in foreground, or find the PID via `<installDir>/storage/print-agent.pid` and
send it `SIGTERM`).

## Difference from a real install

| | Portable / `--dev` | Installed |
|---|---|---|
| Starts at boot | No | Yes |
| Survives a crash (OS restarts it) | No | Yes (`Restart=on-failure` / `KeepAlive` / re-run at next boot) |
| Needs elevated privileges | No | Usually (service registration) |
| Runtime directory layout | Identical | Identical |
