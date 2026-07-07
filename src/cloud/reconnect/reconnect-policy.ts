export interface ReconnectPolicyOptions {
  /** Backoff schedule in ms — Step 6's example: 1s, 2s, 5s, 10s, 20s, 30s. */
  delaysMs?: number[] | undefined;
  /** Ceiling applied once the schedule is exhausted (it repeats the last step forever otherwise). */
  maxDelayMs?: number | undefined;
}

const DEFAULT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];
const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * Exponential-ish backoff by table lookup rather than a formula, matching Step 6's explicit
 * schedule exactly. `reset()` after a successful connection returns to the first (1s) delay.
 */
export class ReconnectPolicy {
  private readonly delaysMs: number[];
  private readonly maxDelayMs: number;
  private attempt = 0;

  constructor(options: ReconnectPolicyOptions = {}) {
    this.delaysMs = options.delaysMs?.length ? options.delaysMs : DEFAULT_DELAYS_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  /** The delay to wait before the next attempt, and advances the internal counter. */
  nextDelayMs(): number {
    const index = Math.min(this.attempt, this.delaysMs.length - 1);
    const delay = Math.min(this.delaysMs[index] ?? this.maxDelayMs, this.maxDelayMs);
    this.attempt += 1;
    return delay;
  }

  reset(): void {
    this.attempt = 0;
  }

  get attemptCount(): number {
    return this.attempt;
  }
}
