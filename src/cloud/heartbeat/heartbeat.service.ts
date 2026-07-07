import { promises as fs } from 'node:fs';
import { freemem, loadavg, networkInterfaces, totalmem } from 'node:os';
import type { PrinterRepository } from '../../database/repositories/index.js';
import type { PrinterManager } from '../../printer/index.js';
import type { QueueService } from '../../queue/index.js';
import type { LoggerService } from '../../services/index.js';
import { CloudEventType, type CloudEventBus } from '../events/index.js';
import { MessageType, createMessage } from '../protocol/index.js';
import type { MachineIdentityService } from '../registration/index.js';
import type { WebSocketClient } from '../websocket/index.js';
import type { HeartbeatPayload, HeartbeatSystemInfo } from './heartbeat.types.js';

const BYTES_PER_MB = 1024 * 1024;

/**
 * Sends a HEARTBEAT at the configured interval (Step 7) — machine ID, queue length, printer
 * status summary, app version, and coarse system stats. Missed sends (socket not open) are
 * counted, not retried; the next scheduled tick tries again on its own.
 */
export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private missedCount = 0;

  constructor(
    private readonly machineIdentityService: MachineIdentityService,
    private readonly queueService: QueueService,
    private readonly printerRepository: PrinterRepository,
    private readonly printerManager: PrinterManager,
    private readonly webSocketClient: WebSocketClient,
    private readonly appVersion: string,
    private readonly events: CloudEventBus,
    private readonly logger: LoggerService,
  ) {}

  start(intervalMs: number): void {
    this.stop();
    this.timer = setInterval(() => {
      void this.sendHeartbeat();
    }, intervalMs);
    this.timer.unref();
    void this.sendHeartbeat();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get missedHeartbeatCount(): number {
    return this.missedCount;
  }

  private async sendHeartbeat(): Promise<void> {
    const payload = await this.buildPayload();
    const sent = this.webSocketClient.send(createMessage(MessageType.Heartbeat, payload));
    const timestamp = new Date().toISOString();
    if (sent) {
      this.events.emitEvent(CloudEventType.HeartbeatSent, { timestamp });
    } else {
      this.missedCount += 1;
      this.events.emitEvent(CloudEventType.HeartbeatMissed, { timestamp, metadata: { missedCount: this.missedCount } });
      this.logger.debug('Heartbeat skipped — cloud connection not open', { missedCount: this.missedCount });
    }
  }

  private async buildPayload(): Promise<HeartbeatPayload> {
    const identity = this.machineIdentityService.get();
    const printerStatusSummary = await this.buildPrinterStatusSummary();

    return {
      machineId: identity.machineUuid,
      appVersion: this.appVersion,
      queueLength: this.queueService.size(),
      printerStatusSummary,
      system: await this.buildSystemInfo(),
    };
  }

  private async buildPrinterStatusSummary(): Promise<Record<string, number>> {
    const printers = this.printerRepository.findAll();
    const summary: Record<string, number> = {};
    for (const printer of printers) {
      let status: string;
      try {
        status = await this.printerManager.getStatus(printer.id);
      } catch {
        status = 'unknown';
      }
      summary[status] = (summary[status] ?? 0) + 1;
    }
    return summary;
  }

  private async buildSystemInfo(): Promise<HeartbeatSystemInfo> {
    const totalMemBytes = totalmem();
    const freeMemBytes = freemem();

    let disk: HeartbeatSystemInfo['disk'] = null;
    try {
      const stats = await fs.statfs(process.cwd());
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      disk = {
        totalMb: Math.round(totalBytes / BYTES_PER_MB),
        freeMb: Math.round(freeBytes / BYTES_PER_MB),
        usedPercent: totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0,
      };
    } catch {
      disk = null;
    }

    const interfaces = Object.entries(networkInterfaces())
      .filter(([, entries]) => entries?.some((entry) => !entry.internal))
      .map(([name]) => name);

    return {
      cpuLoadAverage: loadavg(),
      memory: {
        totalMb: Math.round(totalMemBytes / BYTES_PER_MB),
        freeMb: Math.round(freeMemBytes / BYTES_PER_MB),
        usedPercent: Math.round(((totalMemBytes - freeMemBytes) / totalMemBytes) * 100),
      },
      disk,
      network: { interfaces },
    };
  }
}
