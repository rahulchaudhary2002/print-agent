import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

/**
 * Tracks process identity and uptime, and persists a PID file so external tooling (service
 * scripts, the crash-detection check at the next startup) can find this exact process without
 * scraping `ps` output. "Application uptime" (Step 13) is `process.uptime()` — since Node
 * started; "service uptime" is tracked separately by `ServiceManager` (since it reached
 * `running`, which can differ slightly, and resets on an explicit restart but not a reload).
 */
export class ProcessInfo {
  constructor(private readonly pidFilePath: string) {}

  get pid(): number {
    return process.pid;
  }

  get appUptimeSeconds(): number {
    return process.uptime();
  }

  writePidFile(): void {
    writeFileSync(this.pidFilePath, String(process.pid), 'utf-8');
  }

  removePidFile(): void {
    try {
      unlinkSync(this.pidFilePath);
    } catch {
      // already removed or never written — nothing to clean up
    }
  }

  /** Step 5 — a PID file left behind from a previous run that wasn't cleaned up means that run crashed. */
  readStalePid(): number | null {
    if (!existsSync(this.pidFilePath)) {
      return null;
    }
    const raw = readFileSync(this.pidFilePath, 'utf-8').trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  }
}
