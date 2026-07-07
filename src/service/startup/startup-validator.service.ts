import { accessSync, constants, mkdirSync } from 'node:fs';
import net from 'node:net';
import type { DriverRegistry } from '../../drivers/base/index.js';
import type { Printer } from '../../printer/index.js';
import type { LoggerService } from '../../services/index.js';

export interface ValidationIssue {
  check: string;
  severity: 'fatal' | 'warning';
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  ok: boolean;
}

export interface EnvironmentValidationInput {
  directories: string[];
  port: number;
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

function ok(issues: ValidationIssue[]): boolean {
  return !issues.some((issue) => issue.severity === 'fatal');
}

/**
 * Pre-flight checks (Step 12) — run before the service is allowed to reach "running", so a bad
 * environment produces one clear log line instead of a confusing failure three stages later.
 * Directory/permission failures and a port already in use are fatal; an unsupported printer
 * driver is a warning (that printer just won't accept jobs, everything else still works).
 */
export class StartupValidator {
  constructor(private readonly logger: LoggerService | null) {}

  async validateEnvironment(input: EnvironmentValidationInput): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    for (const dir of input.directories) {
      try {
        mkdirSync(dir, { recursive: true });
        accessSync(dir, constants.W_OK);
      } catch (error) {
        issues.push({
          check: 'storage-permissions',
          severity: 'fatal',
          message: `Cannot write to required directory "${dir}": ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const portAvailable = await checkPortAvailable(input.port);
    if (!portAvailable) {
      issues.push({
        check: 'port-availability',
        severity: 'fatal',
        message: `Port ${input.port} is already in use — another process (or a previous instance of this agent) is bound to it`,
      });
    }

    this.report('environment', issues);
    return { issues, ok: ok(issues) };
  }

  validatePrinters(printers: Printer[], driverRegistry: DriverRegistry): ValidationReport {
    const issues: ValidationIssue[] = [];
    for (const printer of printers) {
      if (!driverRegistry.find(printer.driver)) {
        issues.push({
          check: 'printer-driver',
          severity: 'warning',
          message: `Printer "${printer.name}" (${printer.id}) references unsupported driver "${printer.driver}"`,
        });
      }
    }
    this.report('printers', issues);
    return { issues, ok: ok(issues) };
  }

  private report(section: string, issues: ValidationIssue[]): void {
    for (const issue of issues) {
      const message = `Startup validation (${section}): ${issue.message}`;
      if (issue.severity === 'fatal') {
        this.logger?.error(message, { check: issue.check });
      } else {
        this.logger?.warn(message, { check: issue.check });
      }
    }
    if (issues.length === 0) {
      this.logger?.info(`Startup validation (${section}) passed`);
    }
  }
}
