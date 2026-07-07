import type { PrinterConnection } from '../../printer/printer.types.js';

/**
 * Safe accessors for a driver's untyped `connection` blob. `noPropertyAccessFromIndexSignature`
 * forbids `connection.foo` on a `Record<string, unknown>`, so every driver reads its config through these.
 */
export function readString(connection: PrinterConnection, key: string): string | undefined {
  const value = connection[key];
  return typeof value === 'string' ? value : undefined;
}

export function readNumber(connection: PrinterConnection, key: string): number | undefined {
  const value = connection[key];
  return typeof value === 'number' ? value : undefined;
}

export function readBoolean(connection: PrinterConnection, key: string): boolean | undefined {
  const value = connection[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function requireString(connection: PrinterConnection, key: string, driverName: string): string {
  const value = readString(connection, key);
  if (value === undefined) {
    throw new Error(`Driver "${driverName}" requires connection.${key} to be a string`);
  }
  return value;
}

export function requireNumber(connection: PrinterConnection, key: string, driverName: string): number {
  const value = readNumber(connection, key);
  if (value === undefined) {
    throw new Error(`Driver "${driverName}" requires connection.${key} to be a number`);
  }
  return value;
}
