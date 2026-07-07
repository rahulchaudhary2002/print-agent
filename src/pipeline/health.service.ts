import { promises as fs } from 'node:fs';
import type { DriverRegistry } from '../drivers/base/index.js';
import type { RendererRegistry } from '../document/index.js';
import type { DatabaseService } from '../database/database.service.js';
import type { PrinterRepository, PrintJobRepository } from '../database/repositories/index.js';
import type { QueueService } from '../queue/queue.service.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

const BYTES_PER_MB = 1024 * 1024;

export interface HealthSnapshot {
  status: HealthStatus;
  version: string;
  uptimeSeconds: number;
  queue: {
    length: number;
    oldestPendingAgeMs: number | null;
  };
  renderer: {
    registered: string[];
    healthy: boolean;
  };
  driver: {
    registered: string[];
  };
  database: {
    healthy: boolean;
  };
  printers: {
    total: number;
    enabled: number;
  };
  memory: {
    usedMb: number;
    totalMb: number;
    usedPercent: number;
  };
  cpu: {
    userMs: number;
    systemMs: number;
  };
  disk: {
    totalMb: number;
    freeMb: number;
    usedPercent: number;
  } | null;
}

/** Aggregates cheap, synchronous signals from every layer into one GET /health snapshot (Step 7). */
export class HealthService {
  constructor(
    private readonly queueService: QueueService,
    private readonly printJobRepository: PrintJobRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly rendererRegistry: RendererRegistry,
    private readonly driverRegistry: DriverRegistry,
    private readonly databaseService: DatabaseService,
    private readonly appVersion: string,
  ) {}

  async snapshot(): Promise<HealthSnapshot> {
    const databaseHealthy = this.checkDatabase();
    const registeredRenderers = this.rendererRegistry.list();
    const oldestPendingAgeMs = this.oldestPendingAgeMs();
    const printers = this.printerRepository.findAll();
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const totalMemBytes = memory.rss + memory.heapTotal;

    const status: HealthStatus = !databaseHealthy
      ? 'unhealthy'
      : registeredRenderers.length === 0
        ? 'degraded'
        : 'healthy';

    return {
      status,
      version: this.appVersion,
      uptimeSeconds: Math.round(process.uptime()),
      queue: { length: this.queueService.size(), oldestPendingAgeMs },
      renderer: { registered: registeredRenderers, healthy: registeredRenderers.length > 0 },
      driver: { registered: this.driverRegistry.list() },
      database: { healthy: databaseHealthy },
      printers: { total: printers.length, enabled: printers.filter((printer) => printer.enabled).length },
      memory: {
        usedMb: Math.round(memory.rss / BYTES_PER_MB),
        totalMb: Math.round(totalMemBytes / BYTES_PER_MB),
        usedPercent: totalMemBytes > 0 ? Math.round((memory.rss / totalMemBytes) * 100) : 0,
      },
      cpu: {
        userMs: Math.round(cpu.user / 1000),
        systemMs: Math.round(cpu.system / 1000),
      },
      disk: await this.diskUsage(),
    };
  }

  private checkDatabase(): boolean {
    try {
      this.databaseService.getInstance().prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  /** `findAll('pending')` is ordered by priority first, so the true oldest is found client-side. */
  private oldestPendingAgeMs(): number | null {
    const pending = this.printJobRepository.findAll('pending');
    if (pending.length === 0) {
      return null;
    }
    const oldestCreatedAt = Math.min(...pending.map((job) => new Date(job.createdAt).getTime()));
    return Date.now() - oldestCreatedAt;
  }

  private async diskUsage(): Promise<HealthSnapshot['disk']> {
    try {
      const stats = await fs.statfs(process.cwd());
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      return {
        totalMb: Math.round(totalBytes / BYTES_PER_MB),
        freeMb: Math.round(freeBytes / BYTES_PER_MB),
        usedPercent: totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0,
      };
    } catch {
      return null;
    }
  }
}
