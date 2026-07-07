import { randomUUID } from 'node:crypto';
import type { PrinterRepository } from '../database/repositories/index.js';
import { AppError } from '../utils/index.js';
import type { CreatePrinterInput, Printer, UpdatePrinterInput } from './printer.types.js';

/** CRUD for printer records. No hardware/driver communication happens here. */
export class PrinterService {
  constructor(private readonly printerRepository: PrinterRepository) {}

  create(input: CreatePrinterInput): Printer {
    const now = new Date().toISOString();
    const printer: Printer = {
      id: randomUUID(),
      name: input.name,
      driver: input.driver,
      connectionType: input.connectionType,
      connection: input.connection,
      status: 'offline',
      isDefault: input.isDefault ?? false,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };

    if (printer.isDefault) {
      this.printerRepository.clearDefault();
    }
    this.printerRepository.create(printer);
    return printer;
  }

  update(id: string, input: UpdatePrinterInput): Printer {
    const existing = this.getById(id);

    if (input.isDefault) {
      this.printerRepository.clearDefault();
    }

    const updated: Printer = {
      id: existing.id,
      name: input.name ?? existing.name,
      driver: input.driver ?? existing.driver,
      connectionType: input.connectionType ?? existing.connectionType,
      connection: input.connection ?? existing.connection,
      status: input.status ?? existing.status,
      isDefault: input.isDefault ?? existing.isDefault,
      enabled: input.enabled ?? existing.enabled,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.printerRepository.update(updated);
    return updated;
  }

  delete(id: string): void {
    this.getById(id);
    this.printerRepository.delete(id);
  }

  getById(id: string): Printer {
    const printer = this.printerRepository.findById(id);
    if (!printer) {
      throw new AppError(`Printer ${id} not found`, 404);
    }
    return printer;
  }

  list(): Printer[] {
    return this.printerRepository.findAll();
  }

  setDefault(id: string): Printer {
    const printer = this.getById(id);
    this.printerRepository.clearDefault();

    const updated: Printer = { ...printer, isDefault: true, updatedAt: new Date().toISOString() };
    this.printerRepository.update(updated);
    return updated;
  }

  enable(id: string): Printer {
    return this.setEnabled(id, true);
  }

  disable(id: string): Printer {
    return this.setEnabled(id, false);
  }

  private setEnabled(id: string, enabled: boolean): Printer {
    const printer = this.getById(id);
    const updated: Printer = { ...printer, enabled, updatedAt: new Date().toISOString() };
    this.printerRepository.update(updated);
    return updated;
  }
}
