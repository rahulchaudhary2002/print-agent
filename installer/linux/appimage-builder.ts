import { cpSync, chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commandExists, run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';
import { generatePlaceholderIconSvg } from './icon.js';

function appRunScript(): string {
  return `#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/node" "$HERE/dist/index.js" "$@"
`;
}

function desktopEntry(): string {
  return `[Desktop Entry]
Type=Application
Name=Universal Print Agent
Comment=Local printer discovery, queueing, and printing service
Exec=AppRun
Icon=print-agent
Categories=Utility;
Terminal=false
`;
}

/**
 * Step 5/14 — builds the AppDir (the portable, self-contained layout AppImage packages from)
 * and runs `appimagetool` if it's available. `appimagetool` isn't a package manager package on
 * most distros — it's normally fetched as a standalone binary from its GitHub releases — so it
 * is not expected to be present in most environments (it isn't here). The AppDir is left fully
 * staged either way so the final single-file packaging step can be completed wherever the tool
 * is available, without redoing anything.
 */
export async function buildAppImage(options: {
  projectRoot: string;
  version: string;
  outputDir: string;
  logger: InstallerLogger;
  /** Step 4 — extra files (LICENSE, README, version.json, ...) copied into the AppDir root. */
  extraFiles?: Array<{ source: string; destRelative: string }> | undefined;
}): Promise<string | null> {
  const { projectRoot, outputDir, logger, extraFiles = [] } = options;

  const appDir = join(projectRoot, 'temp', 'AppDir');
  rmSync(appDir, { recursive: true, force: true });
  mkdirSync(join(appDir, 'usr', 'bin'), { recursive: true });

  for (const entry of ['dist', 'package.json', 'node_modules']) {
    const source = join(projectRoot, entry);
    if (existsSync(source)) {
      cpSync(source, join(appDir, entry), { recursive: true });
    }
  }
  for (const extra of extraFiles) {
    if (existsSync(extra.source)) {
      mkdirSync(join(appDir, extra.destRelative, '..'), { recursive: true });
      cpSync(extra.source, join(appDir, extra.destRelative), { recursive: true });
    }
  }
  // The AppImage needs its own copy of the Node runtime — copying the host's `node` binary is
  // the pragmatic default; swap for a specific downloaded Node build if targeting a different
  // machine than the one running this builder.
  cpSync(process.execPath, join(appDir, 'usr', 'bin', 'node'));

  writeFileSync(join(appDir, 'AppRun'), appRunScript(), 'utf-8');
  chmodSync(join(appDir, 'AppRun'), 0o755);
  writeFileSync(join(appDir, 'universal-print-agent.desktop'), desktopEntry(), 'utf-8');
  writeFileSync(join(appDir, 'print-agent.svg'), generatePlaceholderIconSvg(), 'utf-8');

  logger.info('Staged AppDir', { appDir });

  if (!(await commandExists('appimagetool'))) {
    logger.warn(`appimagetool not found — AppDir is staged at ${appDir}; run 'appimagetool ${appDir}' on a machine with it installed to produce the final .AppImage`);
    return null;
  }

  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'UniversalPrintAgent.AppImage');
  const result = await run('appimagetool', [appDir, outputPath]);
  if (result.code !== 0) {
    logger.error('appimagetool failed', { stderr: result.stderr });
    return null;
  }
  logger.info('Built AppImage', { outputPath });
  return outputPath;
}
