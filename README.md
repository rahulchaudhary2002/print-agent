# Universal Print Agent

A local background service for receipt/label printer discovery, queuing, and printing — exposes
a REST API at `http://127.0.0.1:3210/api/v1` for any application on the same machine (see the
official [Laravel/PHP SDK](https://github.com/rahulchaudhary2002/print-agent-php)) to integrate
with, without needing to speak ESC/POS or talk to hardware directly.

## What it does

- Discovers USB/network/Windows/CUPS printers automatically
- Queues, renders (ESC/POS), and prints jobs — text, tables, QR/barcodes, images, cash drawer kick
- Monitors printer and service health, recovers from disconnects automatically
- Runs as a real background service (systemd/Scheduled Task/LaunchAgent) that starts at boot
- Ships an installer, packaging pipeline, and release artifacts for Windows/Linux/macOS

## Quick start

```bash
npm install
npm run build
node dist/index.js
```

Then visit `http://127.0.0.1:3210/docs` for the interactive API reference, or
`http://127.0.0.1:3210/api/v1/health` for a quick status check.

To install it as a persistent background service instead: see
[`installer/docs/INSTALLATION.md`](installer/docs/INSTALLATION.md).

## Documentation

- [`docs/API.md`](docs/API.md) — Local Management REST API
- [`docs/PRINTER_DISCOVERY.md`](docs/PRINTER_DISCOVERY.md) — discovery, health, recovery, profiles
- [`docs/SERVICE_MANAGEMENT.md`](docs/SERVICE_MANAGEMENT.md) — startup/shutdown lifecycle, crash recovery
- [`installer/docs/`](installer/docs/) — installation, upgrade, uninstall, portable mode, troubleshooting
- [`docs/RELEASE.md`](docs/RELEASE.md) — release & packaging pipeline (`npm run release`)

## Project layout

```
src/            Application source (TypeScript, ESM)
installer/      Installation, packaging, and release tooling (see installer/docs/, docs/RELEASE.md)
docs/           Feature-level documentation
bin/            print-agent-ctl CLI
```

## License

ISC — see [LICENSE](LICENSE).
