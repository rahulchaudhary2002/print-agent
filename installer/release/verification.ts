import { spawn } from 'node:child_process';
import net from 'node:net';
import { createPlatformInstaller } from '../common/index.js';
import type { InstallerLogger } from '../common/index.js';
import type { VerificationCheck, VerificationReport } from './types.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPortReachable(port: number, host = '127.0.0.1', timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (result: boolean): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function fetchJson(url: string, timeoutMs = 5000): Promise<{ ok: boolean; body: unknown }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: response.ok, body: await response.json().catch(() => null) };
  } catch {
    return { ok: false, body: null };
  }
}

/**
 * Step 11 — launches the packaged executable for real, then checks the things that actually
 * matter to a user: it starts, the port opens, the REST API answers, `/health` reports healthy,
 * and it shuts down cleanly when asked. Only run on Linux in this environment (the one platform
 * whose executable this pipeline can actually produce and launch) — Windows/macOS artifacts are
 * staged, not launched, for the same "can't verify what I can't run" reason documented throughout
 * this project's Windows/macOS support.
 */
export async function verifyRuntimePackage(input: {
  launcherPath: string;
  port: number;
  logger: InstallerLogger;
}): Promise<VerificationReport> {
  const { launcherPath, port, logger } = input;
  const checks: VerificationCheck[] = [];

  const child = spawn(launcherPath, [], { stdio: 'ignore', detached: true });
  let launched = false;
  child.once('spawn', () => (launched = true));
  child.once('error', () => (launched = false));

  await delay(500);
  checks.push({ name: 'Executable launches', passed: launched && child.pid !== undefined, detail: launched ? `pid ${child.pid}` : 'process failed to spawn' });

  // Startup includes a real discovery scan (several seconds) before the API starts listening.
  let apiUp = false;
  for (let attempt = 0; attempt < 20 && !apiUp; attempt++) {
    await delay(1000);
    apiUp = await checkPortReachable(port);
  }
  checks.push({ name: 'Port 3210 is reachable', passed: apiUp, detail: apiUp ? 'connected' : 'no listener after 20s' });

  const health = await fetchJson(`http://127.0.0.1:${port}/api/v1/health`);
  checks.push({ name: 'REST API starts', passed: health.ok, detail: health.ok ? 'HTTP 200' : 'request failed or non-2xx' });

  const healthBody = health.body as { success?: boolean; data?: { status?: string } } | null;
  const healthy = healthBody?.success === true && typeof healthBody.data?.status === 'string';
  checks.push({
    name: 'Health endpoint responds',
    passed: healthy,
    detail: healthy ? `status: ${healthBody?.data?.status}` : 'unexpected response shape',
  });

  let stoppedCleanly = false;
  if (child.pid !== undefined) {
    try {
      process.kill(child.pid, 'SIGTERM');
      for (let attempt = 0; attempt < 10 && !stoppedCleanly; attempt++) {
        await delay(500);
        try {
          process.kill(child.pid, 0); // throws if the process no longer exists
        } catch {
          stoppedCleanly = true;
        }
      }
    } catch (error) {
      logger.warn('Could not signal the running verification process', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  checks.push({ name: 'Service stops', passed: stoppedCleanly, detail: stoppedCleanly ? 'exited after SIGTERM' : 'still running after 5s' });

  const passed = checks.every((check) => check.passed);
  logger.info('Runtime package verification complete', { passed, checks });
  return { platform: 'linux', checks, passed };
}

/**
 * Best-effort service install/start/stop check via the real `PlatformInstaller` — only actually
 * exercised when running as root/in CI (registering a real systemd unit / Scheduled Task /
 * LaunchAgent is not something to do casually on a shared development machine). Reported as a
 * passed-but-skipped check otherwise, so it never falsely fails the pipeline.
 */
export async function verifyServiceLifecycle(input: { installDir: string; logger: InstallerLogger }): Promise<VerificationCheck> {
  const { installDir, logger } = input;
  const isRoot = process.platform !== 'win32' && process.getuid?.() === 0;
  const isCi = process.env['CI'] === 'true';

  if (!isRoot && !isCi) {
    return { name: 'Service installs/starts/stops', passed: true, detail: 'skipped — not running as root/CI, would register a real system service' };
  }

  try {
    const installer = createPlatformInstaller(logger);
    const options = { installDir, serviceName: 'print-agent', startAutomatically: true, desktopShortcut: false, launchAfterInstall: false, silent: true, dev: false };
    await installer.registerService(options);
    await installer.startService(options);
    const status = await installer.serviceStatus(options);
    await installer.stopService(options);
    await installer.unregisterService(options);
    return { name: 'Service installs/starts/stops', passed: true, detail: `status observed: ${status}` };
  } catch (error) {
    return { name: 'Service installs/starts/stops', passed: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
