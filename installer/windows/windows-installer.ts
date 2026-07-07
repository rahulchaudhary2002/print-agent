import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateWindowsTaskFiles, type InstallerContext } from '../../src/service/installer/index.js';
import type { InstallOptions, PlatformInstaller } from '../common/types.js';
import { run } from '../common/exec-utils.js';
import type { InstallerLogger } from '../common/installer-logger.js';

function buildContext(options: InstallOptions): InstallerContext {
  return {
    nodePath: process.execPath,
    projectRoot: options.installDir,
    entryPoint: join(options.installDir, 'dist', 'index.js'),
    logsDir: join(options.installDir, 'logs'),
    serviceUser: 'SYSTEM',
  };
}

function powershell(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args]);
}

/**
 * Step 4/9 — Windows integration, reusing the Scheduled-Task generator from the
 * service-management phase (see that module's own doc comment for why a Scheduled Task rather
 * than a true SCM service). This module writes the generated scripts to the install directory
 * and invokes them via `powershell.exe`; it does not re-implement any of the task/launcher logic.
 */
export function createWindowsInstaller(logger: InstallerLogger): PlatformInstaller {
  function scriptsDir(options: InstallOptions): string {
    return join(options.installDir, 'temp', 'windows-service');
  }

  function stageScripts(options: InstallOptions): string {
    const dir = scriptsDir(options);
    mkdirSync(dir, { recursive: true });
    for (const file of generateWindowsTaskFiles(buildContext(options))) {
      writeFileSync(join(dir, file.relativePath), file.content, 'utf-8');
    }
    return dir;
  }

  return {
    platform: 'windows',

    async registerService(options: InstallOptions): Promise<void> {
      if (options.dev) {
        logger.info('Developer mode — skipping Scheduled Task registration');
        return;
      }
      const dir = stageScripts(options);
      logger.info('Generated Windows Scheduled Task scripts', { dir });
      const result = await powershell(['-File', join(dir, 'install-service.ps1')]);
      if (result.code !== 0) {
        logger.error('Scheduled Task registration failed — this usually needs an elevated (Administrator) PowerShell', { stderr: result.stderr });
        return;
      }
      logger.info('Scheduled Task registered');
      if (options.startAutomatically) {
        await powershell(['-File', join(dir, 'start-service.ps1')]);
        logger.info('Scheduled Task started');
      }
    },

    async unregisterService(options: InstallOptions): Promise<void> {
      const dir = scriptsDir(options);
      const result = await powershell(['-File', join(dir, 'uninstall-service.ps1')]);
      if (result.code !== 0) {
        logger.error('Scheduled Task removal failed', { stderr: result.stderr });
      }
    },

    async startService(options: InstallOptions): Promise<void> {
      await powershell(['-File', join(scriptsDir(options), 'start-service.ps1')]);
    },

    async stopService(options: InstallOptions): Promise<void> {
      await powershell(['-File', join(scriptsDir(options), 'stop-service.ps1')]);
    },

    async restartService(options: InstallOptions): Promise<void> {
      await powershell(['-File', join(scriptsDir(options), 'restart-service.ps1')]);
    },

    async serviceStatus(): Promise<string> {
      const result = await powershell(['-Command', "(Get-ScheduledTask -TaskName 'PrintAgentService' -ErrorAction SilentlyContinue).State"]);
      return result.stdout.trim() || 'not installed';
    },
  };
}
