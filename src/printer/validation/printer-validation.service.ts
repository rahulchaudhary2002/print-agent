import type { DriverRegistry } from '../../drivers/base/index.js';
import { readNumber, readString } from '../../drivers/base/index.js';
import type { PrinterRepository } from '../../database/repositories/index.js';
import { fingerprintFromConnection } from '../discovery/fingerprint.util.js';
import type { PrinterProfileService } from '../profiles/index.js';
import type { PrinterConnection } from '../printer.types.js';
import { PrinterValidationError } from './printer-validation.error.js';
import type { PrinterValidationInput, ValidationResult } from './printer-validation.types.js';

const KNOWN_PAPER_WIDTHS = new Set(['58mm', '72mm', '80mm', '210mm']);

/** Per-driver required `connection` fields — mirrors what each driver's `initialize()` actually reads. */
function validateConnection(driver: string, connection: PrinterConnection): string[] {
  const errors: string[] = [];
  switch (driver) {
    case 'escpos-usb':
      if (readNumber(connection, 'vendorId') === undefined) errors.push('connection.vendorId must be a number');
      if (readNumber(connection, 'productId') === undefined) errors.push('connection.productId must be a number');
      break;
    case 'network':
      if (readString(connection, 'ip') === undefined) errors.push('connection.ip must be a string');
      break;
    case 'windows':
    case 'cups':
      if (readString(connection, 'printerName') === undefined) errors.push('connection.printerName must be a string');
      break;
    case 'raw':
      if (readString(connection, 'devicePath') === undefined && readString(connection, 'ip') === undefined) {
        errors.push('connection.devicePath or connection.ip must be set');
      }
      break;
    case 'pdf':
      break;
    default:
      break;
  }
  return errors;
}

/**
 * Validates a printer configuration before it's saved (Step 14) — unique identity, supported
 * driver, per-driver connection parameters, paper width, and (when a profile is linked)
 * driver/capability compatibility. Reports every failing rule at once rather than failing fast.
 */
export class PrinterValidationService {
  constructor(
    private readonly driverRegistry: DriverRegistry,
    private readonly printerRepository: PrinterRepository,
    private readonly profileService: PrinterProfileService,
  ) {}

  validate(input: PrinterValidationInput): ValidationResult {
    const errors: string[] = [];

    if (!this.driverRegistry.find(input.driver)) {
      errors.push(`Unsupported driver "${input.driver}"`);
    } else {
      errors.push(...validateConnection(input.driver, input.connection));
    }

    const fingerprint = fingerprintFromConnection(input.driver, input.connection);
    if (fingerprint) {
      const clash = this.printerRepository
        .findAll()
        .find((printer) => printer.id !== input.id && fingerprintFromConnection(printer.driver, printer.connection) === fingerprint);
      if (clash) {
        errors.push(`A printer with this identity is already registered ("${clash.name}")`);
      }
    }

    if (input.paperWidth !== undefined) {
      const isKnownPreset = typeof input.paperWidth === 'string' && KNOWN_PAPER_WIDTHS.has(input.paperWidth);
      const isPositiveNumber = typeof input.paperWidth === 'number' && input.paperWidth > 0;
      if (!isKnownPreset && !isPositiveNumber) {
        errors.push(`Invalid paper width "${String(input.paperWidth)}"`);
      }
    }

    if (input.profileId) {
      try {
        const profile = this.profileService.getById(input.profileId);
        if (!profile.supportedDrivers.includes(input.driver)) {
          errors.push(`Profile "${profile.name}" does not support driver "${input.driver}"`);
        }
      } catch {
        errors.push(`Profile ${input.profileId} not found`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateOrThrow(input: PrinterValidationInput): void {
    const result = this.validate(input);
    if (!result.valid) {
      throw new PrinterValidationError(result.errors);
    }
  }
}
