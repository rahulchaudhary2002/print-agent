import { PrinterCapability } from '../interfaces/printer-capability.enum.js';
import type { PrinterManager } from '../manager/index.js';
import type { PrinterCacheService } from '../cache/index.js';
import type { PrinterConfigurationService } from '../configuration/index.js';
import type { PrinterProfileService } from '../profiles/index.js';
import type { PrinterCapabilitySnapshot } from './capability.types.js';

/**
 * Derives a normalized capability snapshot (Step 9) from the driver's static declared
 * capabilities, layered with any linked printer profile's explicit flags — the profile wins
 * when present, since it reflects what a human has confirmed about that exact hardware model.
 */
export class CapabilityDetectorService {
  constructor(
    private readonly printerManager: PrinterManager,
    private readonly configurationService: PrinterConfigurationService,
    private readonly profileService: PrinterProfileService,
    private readonly cache: PrinterCacheService,
  ) {}

  async detect(printerId: string): Promise<PrinterCapabilitySnapshot> {
    const cached = this.cache.getCapabilities(printerId);
    if (cached) {
      return cached;
    }

    const rawCapabilities = await this.printerManager.getCapabilities(printerId);
    const configuration = this.configurationService.get(printerId);
    const profile = configuration.profileId ? this.profileService.getById(configuration.profileId) : undefined;

    const snapshot: PrinterCapabilitySnapshot = {
      printerId,
      paperWidth: configuration.paperWidth ?? profile?.paperWidth ?? null,
      autoCut: profile?.cutSupport ?? rawCapabilities.includes(PrinterCapability.CutPaper),
      cashDrawer: profile?.cashDrawerSupport ?? rawCapabilities.includes(PrinterCapability.CashDrawer),
      qrCode: profile?.qrSupport ?? rawCapabilities.includes(PrinterCapability.EscPos),
      barcode: profile?.barcodeSupport ?? rawCapabilities.includes(PrinterCapability.EscPos),
      imagePrinting: profile?.imageSupport ?? rawCapabilities.includes(PrinterCapability.Images),
      colorSupport: rawCapabilities.includes(PrinterCapability.Pdf),
      duplex: false,
      rawCapabilities,
      source: profile ? 'driver+profile' : 'driver',
    };

    this.cache.setCapabilities(printerId, snapshot);
    return snapshot;
  }

  invalidate(printerId: string): void {
    this.cache.invalidateCapabilities(printerId);
  }
}
