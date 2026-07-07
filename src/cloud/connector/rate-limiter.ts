/**
 * Step 13 — a sliding-window limiter on incoming commands (PRINT_JOB/JOB_CANCEL/JOB_RETRY/
 * CONFIG_UPDATE), so a compromised or malfunctioning server can't flood the agent with work.
 */
export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  tryAcquire(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((timestamp) => timestamp > cutoff);
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }
}
