import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InstallerLogger,
  REPO_ROOT,
  createPlatformInstaller,
  readVersionManifest,
  type InstallOptions,
} from '../common/index.js';
import { run } from '../common/exec-utils.js';
import { parseArgs, option } from './arg-parser.js';

const API_BASE = 'http://127.0.0.1:3210/api/v1';

function usage(): void {
  console.log(`print-agent-ctl <command> [--install-dir=<path>]

Commands:
  install      Install (or upgrade) the Print Agent as a background service
  uninstall    Stop and remove the service
  start        Start the service
  stop         Stop the service
  restart      Restart the service
  repair       Re-run installation over an existing install (fixes a broken service registration)
  status       Show service status (OS service manager + REST API)
  version      Show installed/schema/config/build version info
  health       Query the REST API's health endpoint
`);
}

const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function baseOptions(installDir: string): InstallOptions {
  return {
    installDir,
    serviceName: 'print-agent',
    startAutomatically: true,
    desktopShortcut: false,
    launchAfterInstall: false,
    silent: true,
    dev: false,
  };
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(5000) });
  return response.json();
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const installDir = option(args, 'install-dir', REPO_ROOT);
  const logger = new InstallerLogger(join(installDir, 'logs', 'installer.log'));

  switch (command) {
    case 'install':
    case 'repair': {
      const scriptPath = fileURLToPath(new URL('./install.ts', import.meta.url));
      const result = await run(TSX_BIN, [scriptPath, ...rest, '--silent']);
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.code;
      return;
    }
    case 'uninstall': {
      const scriptPath = fileURLToPath(new URL('./uninstall.ts', import.meta.url));
      const result = await run(TSX_BIN, [scriptPath, ...rest]);
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.code;
      return;
    }
    case 'start': {
      await createPlatformInstaller(logger).startService(baseOptions(installDir));
      console.log('Service start requested');
      return;
    }
    case 'stop': {
      await createPlatformInstaller(logger).stopService(baseOptions(installDir));
      console.log('Service stop requested');
      return;
    }
    case 'restart': {
      await createPlatformInstaller(logger).restartService(baseOptions(installDir));
      console.log('Service restart requested');
      return;
    }
    case 'status': {
      const installer = createPlatformInstaller(logger);
      const osStatus = await installer.serviceStatus(baseOptions(installDir));
      console.log(`OS service status: ${osStatus}`);
      try {
        const apiStatus = await fetchJson('/service/status');
        console.log('REST API status:', JSON.stringify(apiStatus, null, 2));
      } catch {
        console.log('REST API status: unreachable');
      }
      return;
    }
    case 'version': {
      const manifestPath = join(installDir, 'storage', 'version.json');
      const manifest = readVersionManifest(manifestPath);
      if (!manifest) {
        console.log('No version manifest found — has the agent been installed?');
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }
    case 'health': {
      try {
        const health = await fetchJson('/health');
        console.log(JSON.stringify(health, null, 2));
      } catch (error) {
        console.error('Health check failed:', error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
      return;
    }
    default:
      usage();
      process.exitCode = command ? 1 : 0;
      return;
  }
}

main().catch((error: unknown) => {
  console.error('print-agent-ctl failed', error);
  process.exitCode = 1;
});
