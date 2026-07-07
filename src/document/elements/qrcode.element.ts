import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import type { ElementStyle } from '../interfaces/style.types.js';
import { assertInRange, assertNonEmptyString } from '../interfaces/validation.util.js';

export enum QrErrorCorrectionLevel {
  Low = 'L',
  Medium = 'M',
  Quartile = 'Q',
  High = 'H',
}

/** Module (dot) size in printer units — most ESC/POS QR implementations support 1-16. */
export const MIN_QR_SIZE = 1;
export const MAX_QR_SIZE = 16;

export interface QrCodeElement extends BaseElement {
  type: ElementType.QrCode;
  content: string;
  size: number;
  errorCorrection: QrErrorCorrectionLevel;
  margin: number;
  /** QR model: 1 (original) or 2 (widely supported default). */
  model: 1 | 2;
}

export interface QrCodeElementOptions {
  size?: number | undefined;
  errorCorrection?: QrErrorCorrectionLevel | undefined;
  margin?: number | undefined;
  model?: 1 | 2 | undefined;
  style?: ElementStyle | undefined;
}

export function createQrCodeElement(content: string, options: QrCodeElementOptions = {}): QrCodeElement {
  assertNonEmptyString(content, 'QR code content');

  const size = options.size ?? 4;
  const margin = options.margin ?? 0;
  assertInRange(size, MIN_QR_SIZE, MAX_QR_SIZE, 'QR code size');
  assertInRange(margin, 0, 16, 'QR code margin');

  return {
    type: ElementType.QrCode,
    content,
    size,
    errorCorrection: options.errorCorrection ?? QrErrorCorrectionLevel.Medium,
    margin,
    model: options.model ?? 2,
    style: options.style,
  };
}
