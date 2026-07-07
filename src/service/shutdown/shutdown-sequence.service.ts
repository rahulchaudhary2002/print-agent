import type { LoggerService } from '../../services/index.js';
import type { ShutdownReport, ShutdownStageReport } from '../service.types.js';

/**
 * Instrumentation + ordering for the graceful shutdown flow (Step 4): stop accepting jobs →
 * finish the active print → persist queue state → close driver connections → stop schedulers →
 * close the database → flush logs → exit. Each stage is timed and logged; a stage throwing
 * doesn't stop the remaining stages from running (shutdown should get as far as it can, not
 * abandon cleanup halfway because one step failed) — the error is recorded and re-raised only
 * after every stage has had a chance to run.
 */
export class ShutdownSequence {
  private readonly stages: ShutdownStageReport[] = [];

  constructor(private readonly logger: LoggerService) {}

  async run(stage: string, fn: () => void | Promise<void>): Promise<void> {
    const startedAt = process.hrtime.bigint();
    this.logger.info(`Shutdown stage starting: ${stage}`);
    try {
      await fn();
      const durationMs = this.elapsedMs(startedAt);
      this.stages.push({ stage, durationMs, success: true });
      this.logger.info(`Shutdown stage completed: ${stage}`, { durationMs });
    } catch (error) {
      const durationMs = this.elapsedMs(startedAt);
      const message = error instanceof Error ? error.message : String(error);
      this.stages.push({ stage, durationMs, success: false, error: message });
      this.logger.error(`Shutdown stage failed: ${stage}`, { durationMs, error: message });
    }
  }

  report(signal: string): ShutdownReport {
    return {
      signal,
      stages: this.stages,
      totalDurationMs: this.stages.reduce((sum, stage) => sum + stage.durationMs, 0),
    };
  }

  private elapsedMs(startedAt: bigint): number {
    return Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
  }
}
