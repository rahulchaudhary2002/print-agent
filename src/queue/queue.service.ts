import type { PrintJob } from './print-job.types.js';

/** Plain in-memory FIFO queue of jobs awaiting processing. No persistence, no external broker. */
export class QueueService {
  private readonly jobs: PrintJob[] = [];

  enqueue(job: PrintJob): void {
    this.jobs.push(job);
  }

  dequeue(): PrintJob | undefined {
    return this.jobs.shift();
  }

  peek(): PrintJob | undefined {
    return this.jobs[0];
  }

  remove(jobId: string): boolean {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return false;
    }
    this.jobs.splice(index, 1);
    return true;
  }

  clear(): void {
    this.jobs.length = 0;
  }

  size(): number {
    return this.jobs.length;
  }
}
