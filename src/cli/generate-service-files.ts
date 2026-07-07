import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateLaunchdFiles, generateSystemdFiles, generateWindowsTaskFiles, type GeneratedFile, type InstallerContext } from '../service/installer/index.js';
import { LOGS_DIR, PROJECT_ROOT } from '../utils/index.js';

/**
 * Generates OS-specific service installation artifacts (Step 9/10/11) into `deploy/<platform>/`.
 * Run with `npm run service:generate` after `npm run build`. Doesn't install anything itself —
 * every generated script is meant to be reviewed before running (most need elevated privileges).
 */
function writeFiles(outputDir: string, files: GeneratedFile[]): void {
  mkdirSync(outputDir, { recursive: true });
  for (const file of files) {
    const fullPath = join(outputDir, file.relativePath);
    writeFileSync(fullPath, file.content, 'utf-8');
    if (file.executable && process.platform !== 'win32') {
      chmodSync(fullPath, 0o755);
    }
    console.log(`  wrote ${fullPath}`);
  }
}

function main(): void {
  const context: InstallerContext = {
    nodePath: process.execPath,
    projectRoot: PROJECT_ROOT,
    entryPoint: join(PROJECT_ROOT, 'dist', 'index.js'),
    logsDir: LOGS_DIR,
    serviceUser: process.env['PRINT_AGENT_SERVICE_USER'] ?? 'printagent',
  };

  console.log('Generating Linux (systemd) service files...');
  writeFiles(join(PROJECT_ROOT, 'deploy', 'linux'), generateSystemdFiles(context));

  console.log('Generating Windows (Scheduled Task) service files...');
  writeFiles(join(PROJECT_ROOT, 'deploy', 'windows'), generateWindowsTaskFiles(context));

  console.log('Generating macOS (LaunchAgent) service files...');
  writeFiles(join(PROJECT_ROOT, 'deploy', 'macos'), generateLaunchdFiles(context));

  console.log('\nDone. See docs/SERVICE_MANAGEMENT.md for install instructions per platform.');
}

main();
