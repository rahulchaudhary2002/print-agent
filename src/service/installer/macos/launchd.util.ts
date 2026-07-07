import type { GeneratedFile, InstallerContext } from '../installer.types.js';

const LABEL = 'com.printagent.agent';

/**
 * Step 11 — minimal but architecturally consistent macOS support: a per-user LaunchAgent
 * (simpler and permission-safer than a LaunchDaemon, and sufficient since this agent talks to
 * user-session printers) with `RunAtLoad`/`KeepAlive` covering both "start at boot" and "restart
 * on crash" the same way systemd's `Restart=on-failure` does on Linux.
 */
export function generateLaunchdPlist(context: InstallerContext): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${context.nodePath}</string>
    <string>${context.entryPoint}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${context.projectRoot}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${context.logsDir}/launchd.log</string>
  <key>StandardErrorPath</key>
  <string>${context.logsDir}/launchd-error.log</string>
</dict>
</plist>
`;
}

function installScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
PLIST="${LABEL}.plist"
TARGET="$HOME/Library/LaunchAgents/$PLIST"
mkdir -p "$HOME/Library/LaunchAgents"
cp "$(dirname "$0")/$PLIST" "$TARGET"
launchctl load -w "$TARGET"
echo "Installed and loaded ${LABEL}"
`;
}

function uninstallScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
TARGET="$HOME/Library/LaunchAgents/${LABEL}.plist"
launchctl unload -w "$TARGET" 2>/dev/null || true
rm -f "$TARGET"
echo "Uninstalled ${LABEL}"
`;
}

function manageScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
ACTION="\${1:-status}"

case "$ACTION" in
  start)
    launchctl start ${LABEL}
    ;;
  stop)
    launchctl stop ${LABEL}
    ;;
  restart)
    launchctl stop ${LABEL}
    sleep 1
    launchctl start ${LABEL}
    ;;
  status)
    launchctl list | grep ${LABEL} || echo "${LABEL} is not loaded"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    exit 1
    ;;
esac
`;
}

export function generateLaunchdFiles(context: InstallerContext): GeneratedFile[] {
  return [
    { relativePath: `${LABEL}.plist`, content: generateLaunchdPlist(context) },
    { relativePath: 'install.sh', content: installScript(), executable: true },
    { relativePath: 'uninstall.sh', content: uninstallScript(), executable: true },
    { relativePath: 'manage.sh', content: manageScript(), executable: true },
  ];
}
