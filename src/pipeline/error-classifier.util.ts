import { DocumentValidationError } from '../document/index.js';
import {
  DriverInitializationFailedError,
  PrinterBusyError,
  PrinterOfflineError,
  UnsupportedDriverError,
} from '../printer/interfaces/index.js';
import { PipelineError } from './pipeline.types.js';

/** Transient-looking failure text from drivers (socket errors, USB not found, timeouts). */
const RECOVERABLE_MESSAGE_PATTERN =
  /econnrefused|econnreset|etimedout|enotfound|timed out|timeout|offline|not found on the bus|is not connected|scheduler is not running/i;

/**
 * Retry policy (Step 6): printer-offline / connection-timeout / transient-network failures
 * are worth retrying; invalid documents, unknown drivers/renderers, and validation errors
 * are not — retrying them would just fail the same way `retryCount` more times.
 */
export function classifyRecoverable(error: unknown): boolean {
  if (error instanceof PipelineError) {
    return error.recoverable;
  }
  if (error instanceof DocumentValidationError) {
    return false;
  }
  if (error instanceof UnsupportedDriverError) {
    return false;
  }
  if (error instanceof DriverInitializationFailedError) {
    return false;
  }
  if (error instanceof PrinterOfflineError || error instanceof PrinterBusyError) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return RECOVERABLE_MESSAGE_PATTERN.test(message);
}
