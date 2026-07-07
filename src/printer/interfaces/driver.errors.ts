import { AppError } from '../../utils/index.js';

export class DriverNotFoundError extends AppError {
  constructor(printerId: string) {
    super(`No driver instance is loaded for printer ${printerId}`, 404);
    this.name = 'DriverNotFoundError';
  }
}

export class UnsupportedDriverError extends AppError {
  constructor(driverName: string) {
    super(`Unsupported driver: ${driverName}`, 400);
    this.name = 'UnsupportedDriverError';
  }
}

export class PrinterOfflineError extends AppError {
  constructor(printerId: string) {
    super(`Printer ${printerId} is offline`, 503);
    this.name = 'PrinterOfflineError';
  }
}

export class PrinterBusyError extends AppError {
  constructor(printerId: string) {
    super(`Printer ${printerId} is busy`, 409);
    this.name = 'PrinterBusyError';
  }
}

export class DriverInitializationFailedError extends AppError {
  constructor(driverName: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'unknown error';
    super(`Failed to initialize driver "${driverName}": ${reason}`, 500);
    this.name = 'DriverInitializationFailedError';
  }
}
