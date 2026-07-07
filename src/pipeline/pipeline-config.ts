export interface PipelineConfig {
  concurrentJobs?: number | undefined;
  retryCount?: number | undefined;
  retryDelayMs?: number | undefined;
  queuePollIntervalMs?: number | undefined;
  shutdownTimeoutMs?: number | undefined;
  renderTimeoutMs?: number | undefined;
  printTimeoutMs?: number | undefined;
}

export type ResolvedPipelineConfig = {
  [K in keyof PipelineConfig]-?: NonNullable<PipelineConfig[K]>;
};

export const DEFAULT_PIPELINE_CONFIG: ResolvedPipelineConfig = {
  concurrentJobs: 1,
  retryCount: 3,
  retryDelayMs: 0,
  queuePollIntervalMs: 500,
  shutdownTimeoutMs: 10_000,
  renderTimeoutMs: 10_000,
  printTimeoutMs: 15_000,
};

export function resolvePipelineConfig(config: PipelineConfig = {}): ResolvedPipelineConfig {
  return {
    concurrentJobs: config.concurrentJobs ?? DEFAULT_PIPELINE_CONFIG.concurrentJobs,
    retryCount: config.retryCount ?? DEFAULT_PIPELINE_CONFIG.retryCount,
    retryDelayMs: config.retryDelayMs ?? DEFAULT_PIPELINE_CONFIG.retryDelayMs,
    queuePollIntervalMs: config.queuePollIntervalMs ?? DEFAULT_PIPELINE_CONFIG.queuePollIntervalMs,
    shutdownTimeoutMs: config.shutdownTimeoutMs ?? DEFAULT_PIPELINE_CONFIG.shutdownTimeoutMs,
    renderTimeoutMs: config.renderTimeoutMs ?? DEFAULT_PIPELINE_CONFIG.renderTimeoutMs,
    printTimeoutMs: config.printTimeoutMs ?? DEFAULT_PIPELINE_CONFIG.printTimeoutMs,
  };
}
