const DEFAULT_SEEN_ID_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_TRACKED_IDS = 10_000; // hard cap so a malicious server can't grow this unbounded

/**
 * Rejects a message if its `id` has already been processed recently, or its `timestamp` is
 * implausibly old/future — the two classic replay-attack mitigations. Deliberately in-memory
 * only: a restart naturally has nothing to replay against yet.
 */
export class ReplayGuard {
  private readonly seenIds = new Map<string, number>();

  constructor(
    private readonly seenIdTtlMs = DEFAULT_SEEN_ID_TTL_MS,
    private readonly clockSkewToleranceMs = DEFAULT_CLOCK_SKEW_TOLERANCE_MS,
  ) {}

  /** Returns true (and records the id) if this message is fresh; false if it's a replay/too skewed. */
  accept(id: string, timestamp: string): boolean {
    this.evictExpired();

    const messageTimeMs = new Date(timestamp).getTime();
    if (Number.isNaN(messageTimeMs) || Math.abs(Date.now() - messageTimeMs) > this.clockSkewToleranceMs) {
      return false;
    }
    if (this.seenIds.has(id)) {
      return false;
    }

    if (this.seenIds.size >= MAX_TRACKED_IDS) {
      const oldestId = this.seenIds.keys().next().value;
      if (oldestId !== undefined) {
        this.seenIds.delete(oldestId);
      }
    }
    this.seenIds.set(id, Date.now());
    return true;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.seenIdTtlMs;
    for (const [id, seenAt] of this.seenIds) {
      if (seenAt < cutoff) {
        this.seenIds.delete(id);
      }
    }
  }
}
