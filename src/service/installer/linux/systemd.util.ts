import type { GeneratedFile, InstallerContext } from '../installer.types.js';

const SERVICE_NAME = 'print-agent';

/**
 * Step 10 — a systemd unit plus install/uninstall/manage shell scripts. Runs under a dedicated,
 * unprivileged `serviceUser` (created by `install.sh` if it doesn't already exist) rather than
 * root, and restarts automatically on crash — `restart-on-failure` here is the process-level
 * complement to the in-app watchdog restarting individual workers (Step 6/14).
 */
export function generateSystemdUnit(context: InstallerContext): string {
  return `[Unit]
Description=Universal Print Agent
After=network.target

[Service]
Type=simple
User=${context.serviceUser}
Group=${context.serviceUser}
WorkingDirectory=${context.projectRoot}
ExecStart=${context.nodePath} ${context.entryPoint}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=append:${context.logsDir}/systemd.log
StandardError=append:${context.logsDir}/systemd-error.log

[Install]
WantedBy=multi-user.target
`;
}

function installScript(context: InstallerContext): string {
  return `#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME}"
SERVICE_USER="${context.serviceUser}"
UNIT_PATH="/etc/systemd/system/\${SERVICE_NAME}.service"

if [ "$EUID" -ne 0 ]; then
  echo "Run as root (sudo ./install.sh)" >&2
  exit 1
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "Creating dedicated service user: $SERVICE_USER"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "${context.projectRoot}/storage" "${context.logsDir}" 2>/dev/null || true

cp "$(dirname "$0")/${SERVICE_NAME}.service" "$UNIT_PATH"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "Installed. Start it with: sudo systemctl start $SERVICE_NAME"
`;
}

function uninstallScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME}"

if [ "$EUID" -ne 0 ]; then
  echo "Run as root (sudo ./uninstall.sh)" >&2
  exit 1
fi

systemctl disable --now "$SERVICE_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/\${SERVICE_NAME}.service"
systemctl daemon-reload

echo "Uninstalled $SERVICE_NAME"
`;
}

function manageScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME}"
ACTION="\${1:-status}"

case "$ACTION" in
  start|stop|restart|status)
    systemctl "$ACTION" "$SERVICE_NAME"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    exit 1
    ;;
esac
`;
}

export function generateSystemdFiles(context: InstallerContext): GeneratedFile[] {
  return [
    { relativePath: `${SERVICE_NAME}.service`, content: generateSystemdUnit(context) },
    { relativePath: 'install.sh', content: installScript(context), executable: true },
    { relativePath: 'uninstall.sh', content: uninstallScript(), executable: true },
    { relativePath: 'manage.sh', content: manageScript(), executable: true },
  ];
}
