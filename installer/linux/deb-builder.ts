import { cpSync, chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSystemdUnit } from '../../src/service/installer/index.js';
import { commandExists, run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';

const INSTALL_PREFIX = '/opt/print-agent';

function controlFile(version: string, architecture: string): string {
  return `Package: print-agent
Version: ${version}
Section: utils
Priority: optional
Architecture: ${architecture}
Maintainer: Print Agent <support@example.invalid>
Depends: nodejs (>= 18)
Description: Universal Print Agent
 Local background service exposing a REST API for receipt/label printer
 discovery, queueing, and printing.
`;
}

function postinstScript(): string {
  return `#!/bin/sh
set -e
id -u printagent >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin printagent
mkdir -p ${INSTALL_PREFIX}/storage ${INSTALL_PREFIX}/logs ${INSTALL_PREFIX}/temp
chown -R printagent:printagent ${INSTALL_PREFIX}/storage ${INSTALL_PREFIX}/logs ${INSTALL_PREFIX}/temp
systemctl daemon-reload
systemctl enable print-agent.service
systemctl start print-agent.service || true
exit 0
`;
}

function prermScript(): string {
  return `#!/bin/sh
set -e
systemctl stop print-agent.service || true
exit 0
`;
}

function postrmScript(): string {
  return `#!/bin/sh
set -e
if [ "$1" = "purge" ]; then
  rm -rf ${INSTALL_PREFIX}/storage ${INSTALL_PREFIX}/logs
  systemctl daemon-reload || true
fi
exit 0
`;
}

/**
 * Step 5/14 — builds a real, installable .deb using the system's own \`dpkg-deb\`. Runs the
 * exact same systemd unit generator the service-management phase built, and ships the already
 * compiled \`dist/\` + \`node_modules\` so the package needs nothing beyond a Node.js runtime and
 * \`systemd\` on the target machine.
 */
export async function buildDebPackage(options: {
  projectRoot: string;
  version: string;
  outputDir: string;
  logger: InstallerLogger;
}): Promise<string | null> {
  const { projectRoot, version, outputDir, logger } = options;

  if (!(await commandExists('dpkg-deb'))) {
    logger.warn('dpkg-deb not found — skipping .deb build. Install dpkg-dev to enable this.');
    return null;
  }

  const architecture = process.arch === 'x64' ? 'amd64' : process.arch === 'arm64' ? 'arm64' : process.arch;
  const stagingDir = join(projectRoot, 'temp', 'deb-staging');
  rmSync(stagingDir, { recursive: true, force: true });

  const debianDir = join(stagingDir, 'DEBIAN');
  const appDir = join(stagingDir, 'opt', 'print-agent');
  const systemdDir = join(stagingDir, 'etc', 'systemd', 'system');
  mkdirSync(debianDir, { recursive: true });
  mkdirSync(appDir, { recursive: true });
  mkdirSync(systemdDir, { recursive: true });

  for (const entry of ['dist', 'package.json', 'node_modules']) {
    const source = join(projectRoot, entry);
    if (existsSync(source)) {
      cpSync(source, join(appDir, entry), { recursive: true });
    }
  }

  writeFileSync(join(debianDir, 'control'), controlFile(version, architecture), 'utf-8');
  writeFileSync(join(debianDir, 'postinst'), postinstScript(), 'utf-8');
  writeFileSync(join(debianDir, 'prerm'), prermScript(), 'utf-8');
  writeFileSync(join(debianDir, 'postrm'), postrmScript(), 'utf-8');
  for (const script of ['postinst', 'prerm', 'postrm']) {
    chmodSync(join(debianDir, script), 0o755);
  }

  writeFileSync(
    join(systemdDir, 'print-agent.service'),
    generateSystemdUnit({
      // Absolute path required by systemd's ExecStart; `env` resolves `node` via PATH at
      // service-start time, which tolerates nvm/version-manager Node installs that a hardcoded
      // `/usr/bin/node` would not (a real limitation of packaging a Node app as a native .deb).
      nodePath: '/usr/bin/env node',
      projectRoot: INSTALL_PREFIX,
      entryPoint: `${INSTALL_PREFIX}/dist/index.js`,
      logsDir: `${INSTALL_PREFIX}/logs`,
      serviceUser: 'printagent',
    }),
    'utf-8',
  );

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `print-agent_${version}_${architecture}.deb`);

  const hasFakeroot = await commandExists('fakeroot');
  const result = hasFakeroot
    ? await run('fakeroot', ['dpkg-deb', '--build', stagingDir, outputPath])
    : await run('dpkg-deb', ['--build', '--root-owner-group', stagingDir, outputPath]);

  if (result.code !== 0) {
    logger.error('dpkg-deb build failed', { stderr: result.stderr });
    return null;
  }

  logger.info('Built .deb package', { outputPath });
  return outputPath;
}
