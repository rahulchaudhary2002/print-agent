import type { PrinterConnection } from '../printer.types.js';

export interface PrinterValidationInput {
  /** Present when validating an update — excludes the printer itself from the uniqueness check. */
  id?: string | undefined;
  driver: string;
  connection: PrinterConnection;
  paperWidth?: string | number | undefined;
  profileId?: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
