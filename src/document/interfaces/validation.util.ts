import { DocumentValidationError } from './document-error.js';

/** Shared assertions used by every element factory so validation errors read consistently. */
export function assertNonEmptyString(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new DocumentValidationError(`${fieldName} must not be empty`);
  }
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DocumentValidationError(`${fieldName} must be a positive integer`);
  }
}

export function assertInRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new DocumentValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
}

export function assertOneOf<T>(value: T, allowed: readonly T[], fieldName: string): void {
  if (!allowed.includes(value)) {
    throw new DocumentValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }
}

export function assertMatches(value: string, pattern: RegExp, fieldName: string, description: string): void {
  if (!pattern.test(value)) {
    throw new DocumentValidationError(`${fieldName} ${description}`);
  }
}
