import { randomUUID } from 'node:crypto';
import type { PrinterProfileRepository } from '../../database/repositories/index.js';
import { AppError } from '../../utils/index.js';
import { BUILT_IN_PRINTER_PROFILES } from './built-in-profiles.data.js';
import type { CreatePrinterProfileInput, PrinterProfile, UpdatePrinterProfileInput } from './printer-profile.types.js';

/** Reusable printer profiles (Step 8) — built-ins are seeded in code; custom ones persist to SQLite. */
export class PrinterProfileService {
  constructor(private readonly profileRepository: PrinterProfileRepository) {}

  list(): PrinterProfile[] {
    return [...BUILT_IN_PRINTER_PROFILES, ...this.profileRepository.findAll()];
  }

  getById(id: string): PrinterProfile {
    const profile = this.list().find((candidate) => candidate.id === id);
    if (!profile) {
      throw new AppError(`Printer profile ${id} not found`, 404);
    }
    return profile;
  }

  create(input: CreatePrinterProfileInput): PrinterProfile {
    const now = new Date().toISOString();
    const profile: PrinterProfile = {
      id: randomUUID(),
      name: input.name,
      model: input.model ?? null,
      paperWidth: input.paperWidth,
      defaultRenderer: input.defaultRenderer,
      supportedDrivers: input.supportedDrivers,
      encoding: input.encoding,
      capabilities: input.capabilities ?? [],
      imageSupport: input.imageSupport ?? false,
      qrSupport: input.qrSupport ?? false,
      barcodeSupport: input.barcodeSupport ?? false,
      cashDrawerSupport: input.cashDrawerSupport ?? false,
      cutSupport: input.cutSupport ?? false,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };
    this.profileRepository.create(profile);
    return profile;
  }

  update(id: string, input: UpdatePrinterProfileInput): PrinterProfile {
    const existing = this.getExistingCustomProfile(id);
    const updated: PrinterProfile = {
      ...existing,
      name: input.name ?? existing.name,
      model: input.model ?? existing.model,
      paperWidth: input.paperWidth ?? existing.paperWidth,
      defaultRenderer: input.defaultRenderer ?? existing.defaultRenderer,
      supportedDrivers: input.supportedDrivers ?? existing.supportedDrivers,
      encoding: input.encoding ?? existing.encoding,
      capabilities: input.capabilities ?? existing.capabilities,
      imageSupport: input.imageSupport ?? existing.imageSupport,
      qrSupport: input.qrSupport ?? existing.qrSupport,
      barcodeSupport: input.barcodeSupport ?? existing.barcodeSupport,
      cashDrawerSupport: input.cashDrawerSupport ?? existing.cashDrawerSupport,
      cutSupport: input.cutSupport ?? existing.cutSupport,
      updatedAt: new Date().toISOString(),
    };
    this.profileRepository.update(updated);
    return updated;
  }

  delete(id: string): void {
    this.getExistingCustomProfile(id);
    this.profileRepository.delete(id);
  }

  private getExistingCustomProfile(id: string): PrinterProfile {
    if (BUILT_IN_PRINTER_PROFILES.some((profile) => profile.id === id)) {
      throw new AppError(`Profile ${id} is built-in and cannot be modified`, 400);
    }
    const profile = this.profileRepository.findById(id);
    if (!profile) {
      throw new AppError(`Printer profile ${id} not found`, 404);
    }
    return profile;
  }
}
