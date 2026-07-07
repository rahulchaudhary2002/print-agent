import { AppError } from '../../utils/index.js';

/** Raised when a printer configuration fails validation (Step 14) — carries every failed rule, not just the first. */
export class PrinterValidationError extends AppError {
  constructor(public readonly issues: string[]) {
    super(issues.join('; ') || 'Printer configuration is invalid', 422);
    this.name = 'PrinterValidationError';
  }
}
