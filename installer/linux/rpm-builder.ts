import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSystemdUnit } from '../../src/service/installer/index.js';
import { commandExists, run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';

const INSTALL_PREFIX = '/opt/print-agent';

function specFile(version: string): string {
  return `Name: print-agent
Version: ${version}
Release: 1%{?dist}
Summary: Universal Print Agent
License: ISC
BuildArch: %{_arch}
Requires: nodejs >= 18
%description
Local background service exposing a REST API for receipt/label printer
discovery, queueing, and printing.

%install
mkdir -p %{buildroot}${INSTALL_PREFIX}
cp -r %{_sourcedir}/app/* %{buildroot}${INSTALL_PREFIX}/
mkdir -p %{buildroot}/etc/systemd/system
cp %{_sourcedir}/print-agent.service %{buildroot}/etc/systemd/system/print-agent.service

%files
${INSTALL_PREFIX}
/etc/systemd/system/print-agent.service

%pre
getent passwd printagent >/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin printagent

%post
mkdir -p ${INSTALL_PREFIX}/storage ${INSTALL_PREFIX}/logs ${INSTALL_PREFIX}/temp
chown -R printagent:printagent ${INSTALL_PREFIX}/storage ${INSTALL_PREFIX}/logs ${INSTALL_PREFIX}/temp
systemctl daemon-reload
systemctl enable print-agent.service
systemctl start print-agent.service || true

%preun
systemctl stop print-agent.service || true

%postun
if [ "$1" = "0" ]; then
  systemctl daemon-reload || true
fi
`;
}

/**
 * Step 5/14 — produces a real RPM spec plus the staged source tree `rpmbuild` needs. Only
 * actually invokes `rpmbuild` if it's present on the host (common on Fedora/RHEL, not on
 * Debian/Ubuntu or this development sandbox) — otherwise the spec and staged sources are left
 * in place so the build can be finished on a machine that has it, without re-deriving anything.
 */
export async function buildRpmPackage(options: {
  projectRoot: string;
  version: string;
  outputDir: string;
  logger: InstallerLogger;
}): Promise<string | null> {
  const { projectRoot, version, outputDir, logger } = options;

  const rpmbuildRoot = join(projectRoot, 'temp', 'rpmbuild');
  const sourcesDir = join(rpmbuildRoot, 'SOURCES');
  const specsDir = join(rpmbuildRoot, 'SPECS');
  const appStagingDir = join(sourcesDir, 'app');
  for (const dir of ['SOURCES', 'SPECS', 'RPMS', 'SRPMS', 'BUILD', 'BUILDROOT']) {
    mkdirSync(join(rpmbuildRoot, dir), { recursive: true });
  }
  rmSync(appStagingDir, { recursive: true, force: true });
  mkdirSync(appStagingDir, { recursive: true });

  for (const entry of ['dist', 'package.json', 'node_modules']) {
    const source = join(projectRoot, entry);
    if (existsSync(source)) {
      cpSync(source, join(appStagingDir, entry), { recursive: true });
    }
  }

  writeFileSync(
    join(sourcesDir, 'print-agent.service'),
    generateSystemdUnit({
      nodePath: '/usr/bin/env node',
      projectRoot: INSTALL_PREFIX,
      entryPoint: `${INSTALL_PREFIX}/dist/index.js`,
      logsDir: `${INSTALL_PREFIX}/logs`,
      serviceUser: 'printagent',
    }),
    'utf-8',
  );

  const specPath = join(specsDir, 'print-agent.spec');
  writeFileSync(specPath, specFile(version), 'utf-8');
  logger.info('Generated RPM spec and staged sources', { specPath });

  if (!(await commandExists('rpmbuild'))) {
    logger.warn(`rpmbuild not found — spec and sources are staged at ${rpmbuildRoot}; run 'rpmbuild --define "_topdir ${rpmbuildRoot}" -bb ${specPath}' on a machine with rpmbuild installed`);
    return null;
  }

  mkdirSync(outputDir, { recursive: true });
  const result = await run('rpmbuild', ['--define', `_topdir ${rpmbuildRoot}`, '-bb', specPath]);
  if (result.code !== 0) {
    logger.error('rpmbuild failed', { stderr: result.stderr });
    return null;
  }

  const rpmsDir = join(rpmbuildRoot, 'RPMS');
  logger.info('Built RPM package', { rpmsDir });
  return rpmsDir;
}
