import { accessSync, constants, existsSync, statfsSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname } from 'node:path';
import type { ValidationIssue, ValidationReport } from './types.js';

const MIN_DISK_SPACE_MB = 200;
const MIN_FREE_MEMORY_MB = 128;
const SUPPORTED_PLATFORMS = new Set(['win32', 'linux', 'darwin']);
const SUPPORTED_ARCHITECTURES = new Set(['x64', 'arm64']);

function ok(issues: ValidationIssue[]): boolean {
  return !issues.some((issue) => issue.severity === 'fatal');
}

function nearestExistingAncestor(dir: string): string {
  let current = dir;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return '.';
    }
    current = parent;
  }
  return current;
}

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

/**
 * Step 9 — everything the installer verifies before touching the filesystem for real. Mirrors
 * the shape of `StartupValidator` from the service-management phase (fatal vs. warning issues,
 * one combined report) but is a separate, standalone implementation — the installer must not
 * import from `src/service/` for this, since it needs to run before any app code is even in
 * its final location.
 */
export async function validateEnvironment(input: { installDir: string; port: number }): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];

  if (!SUPPORTED_PLATFORMS.has(process.platform)) {
    issues.push({ check: 'operating-system', severity: 'fatal', message: `Unsupported operating system: ${process.platform}` });
  }
  if (!SUPPORTED_ARCHITECTURES.has(process.arch)) {
    issues.push({ check: 'architecture', severity: 'warning', message: `Untested CPU architecture: ${process.arch}` });
  }

  try {
    const stats = statfsSync(nearestExistingAncestor(input.installDir));
    const freeMb = (stats.bavail * stats.bsize) / (1024 * 1024);
    if (freeMb < MIN_DISK_SPACE_MB) {
      issues.push({ check: 'disk-space', severity: 'fatal', message: `Only ${Math.round(freeMb)}MB free, need at least ${MIN_DISK_SPACE_MB}MB` });
    }
  } catch (error) {
    issues.push({ check: 'disk-space', severity: 'warning', message: `Could not determine free disk space: ${error instanceof Error ? error.message : String(error)}` });
  }

  const freeMemoryMb = os.freemem() / (1024 * 1024);
  if (freeMemoryMb < MIN_FREE_MEMORY_MB) {
    issues.push({ check: 'memory', severity: 'warning', message: `Only ${Math.round(freeMemoryMb)}MB free memory available` });
  }

  try {
    accessSync(input.installDir, constants.W_OK);
  } catch {
    // installDir may not exist yet on a fresh install — that's fine, checked separately below
  }

  const portAvailable = await checkPortAvailable(input.port);
  if (!portAvailable) {
    issues.push({ check: 'port-availability', severity: 'fatal', message: `Port ${input.port} is already in use` });
  }

  return { issues, ok: ok(issues) };
}

export function validateWritable(dir: string): ValidationIssue | null {
  try {
    accessSync(dir, constants.W_OK);
    return null;
  } catch (error) {
    return { check: 'write-permissions', severity: 'fatal', message: `Cannot write to "${dir}": ${error instanceof Error ? error.message : String(error)}` };
  }
}
