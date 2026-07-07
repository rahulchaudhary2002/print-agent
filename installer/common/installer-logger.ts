import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Step 12 — a standalone logger for installer operations (install/upgrade/repair/rollback/
 * uninstall/migration/permission errors), deliberately independent of the app's own
 * `LoggerService` (pino): the installer must be able to log *before* the application's own
 * directories necessarily exist, and shouldn't need the app's dependency graph just to report
 * "permission denied creating storage/".
 */
export class InstallerLogger {
  constructor(private readonly logFilePath: string) {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('ERROR', message, meta);
  }

  private write(level: string, message: string, meta?: Record<string, unknown>): void {
    const line = `${new Date().toISOString()} [${level}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    console.log(line);
    try {
      mkdirSync(dirname(this.logFilePath), { recursive: true });
      appendFileSync(this.logFilePath, line + '\n', 'utf-8');
    } catch {
      // logging to the installer log is best-effort — console output above is the fallback
    }
  }
}
