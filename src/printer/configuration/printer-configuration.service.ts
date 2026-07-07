import type { ConfigService } from '../../config/index.js';
import type { PrinterConfigurationRepository, PrinterRepository } from '../../database/repositories/index.js';
import { AppError } from '../../utils/index.js';
import type { PrinterCacheService } from '../cache/index.js';
import { PrinterEventBus, PrinterEventType } from '../events/index.js';
import type { PrinterConfiguration, UpdatePrinterConfigurationInput } from './printer-configuration.types.js';

/**
 * Extended, persisted per-printer settings (Step 10) — friendly name, preferred driver/renderer,
 * paper width, timeout, retry policy, linked profile. Layers on top of the core `printers` table
 * (name/driver/connection/enabled/isDefault already live there) rather than duplicating it.
 */
export class PrinterConfigurationService {
  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly configurationRepository: PrinterConfigurationRepository,
    private readonly configService: ConfigService,
    private readonly cache: PrinterCacheService,
    private readonly eventBus: PrinterEventBus,
  ) {}

  get(printerId: string): PrinterConfiguration {
    const printer = this.getPrinterOrThrow(printerId);
    const overrides = this.configurationRepository.findByPrinterId(printerId);

    return {
      printerId,
      friendlyName: overrides?.friendlyName ?? printer.name,
      isDefaultPrinter: printer.isDefault,
      preferredDriver: overrides?.preferredDriver ?? printer.driver,
      paperWidth: overrides?.paperWidth ?? null,
      renderer: overrides?.renderer ?? null,
      timeoutMs: overrides?.timeoutMs ?? this.configService.get('printTimeoutMs'),
      retryMax: overrides?.retryMax ?? this.configService.get('retryCount'),
      retryBackoffMs: overrides?.retryBackoffMs ?? 1000,
      enabled: printer.enabled,
      profileId: overrides?.profileId ?? null,
      updatedAt: overrides?.updatedAt ?? printer.updatedAt,
    };
  }

  list(): PrinterConfiguration[] {
    return this.printerRepository.findAll().map((printer) => this.get(printer.id));
  }

  update(printerId: string, input: UpdatePrinterConfigurationInput): PrinterConfiguration {
    this.getPrinterOrThrow(printerId);
    const existing = this.configurationRepository.findByPrinterId(printerId);
    const now = new Date().toISOString();

    this.configurationRepository.upsert({
      printerId,
      friendlyName: input.friendlyName !== undefined ? input.friendlyName : (existing?.friendlyName ?? null),
      profileId: input.profileId !== undefined ? input.profileId : (existing?.profileId ?? null),
      preferredDriver: input.preferredDriver !== undefined ? input.preferredDriver : (existing?.preferredDriver ?? null),
      paperWidth: input.paperWidth !== undefined ? input.paperWidth : (existing?.paperWidth ?? null),
      renderer: input.renderer !== undefined ? input.renderer : (existing?.renderer ?? null),
      timeoutMs: input.timeoutMs !== undefined ? input.timeoutMs : (existing?.timeoutMs ?? null),
      retryMax: input.retryMax !== undefined ? input.retryMax : (existing?.retryMax ?? null),
      retryBackoffMs: input.retryBackoffMs !== undefined ? input.retryBackoffMs : (existing?.retryBackoffMs ?? null),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    this.cache.invalidateCapabilities(printerId);
    this.eventBus.emitEvent(PrinterEventType.ConfigurationChanged, { printerId, timestamp: now });
    return this.get(printerId);
  }

  private getPrinterOrThrow(printerId: string) {
    const printer = this.printerRepository.findById(printerId);
    if (!printer) {
      throw new AppError(`Printer ${printerId} not found`, 404);
    }
    return printer;
  }
}
