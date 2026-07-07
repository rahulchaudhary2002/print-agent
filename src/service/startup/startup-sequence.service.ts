import type { LoggerService } from '../../services/index.js';
import type { StartupReport, StartupStageReport } from '../service.types.js';

/**
 * Instrumentation wrapper around the existing boot sequence in `index.ts` (Step 3) — every
 * stage of the already-established construction order (config → logger → database → drivers →
 * printers → queue → workers → API) is timed and logged without changing what each stage does.
 * Two config/logger stages happen before a `LoggerService` exists, so those are recorded via
 * `recordExternal` instead of `run`.
 */
export class StartupSequence {
  private readonly stages: StartupStageReport[] = [];
  private readonly startedAt = new Date().toISOString();

  constructor(private readonly logger: LoggerService | null) {}

  async run<T>(stage: string, fn: () => T | Promise<T>): Promise<T> {
    const startedAt = process.hrtime.bigint();
    this.logger?.info(`Startup stage starting: ${stage}`);
    try {
      const result = await fn();
      this.recordExternal(stage, this.elapsedMs(startedAt), true);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.recordExternal(stage, this.elapsedMs(startedAt), false, message);
      throw error;
    }
  }

  /** For stages measured manually (e.g. before the logger itself exists). */
  recordExternal(stage: string, durationMs: number, success: boolean, error?: string): void {
    this.stages.push({ stage, durationMs, success, error });
    if (success) {
      this.logger?.info(`Startup stage completed: ${stage}`, { durationMs });
    } else {
      this.logger?.error(`Startup stage failed: ${stage}`, { durationMs, error });
    }
  }

  report(): StartupReport {
    return {
      stages: this.stages,
      totalDurationMs: this.stages.reduce((sum, stage) => sum + stage.durationMs, 0),
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  private elapsedMs(startedAt: bigint): number {
    return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  }
}
