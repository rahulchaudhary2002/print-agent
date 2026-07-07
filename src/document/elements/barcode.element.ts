import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import type { ElementStyle } from '../interfaces/style.types.js';
import { DocumentValidationError } from '../interfaces/document-error.js';
import { assertMatches } from '../interfaces/validation.util.js';

export enum BarcodeType {
  Ean13 = 'EAN13',
  Ean8 = 'EAN8',
  Upc = 'UPC',
  Code39 = 'CODE39',
  Code128 = 'CODE128',
  Itf = 'ITF',
  Codabar = 'CODABAR',
}

export interface BarcodeElement extends BaseElement {
  type: ElementType.Barcode;
  barcodeType: BarcodeType;
  value: string;
  height?: number | undefined;
  width?: number | undefined;
  showText?: boolean | undefined;
}

export interface BarcodeElementOptions {
  height?: number | undefined;
  width?: number | undefined;
  showText?: boolean | undefined;
  style?: ElementStyle | undefined;
}

/**
 * Validation only — no barcode symbology is generated here, just a check that `value`
 * could plausibly be encoded by the given barcode type once a real renderer exists.
 */
export function validateBarcodeValue(barcodeType: BarcodeType, value: string): void {
  switch (barcodeType) {
    case BarcodeType.Ean13:
      assertMatches(value, /^\d{12,13}$/, 'EAN13 value', 'must be 12 or 13 digits');
      return;
    case BarcodeType.Ean8:
      assertMatches(value, /^\d{7,8}$/, 'EAN8 value', 'must be 7 or 8 digits');
      return;
    case BarcodeType.Upc:
      assertMatches(value, /^\d{11,12}$/, 'UPC value', 'must be 11 or 12 digits');
      return;
    case BarcodeType.Code39:
      assertMatches(value, /^[0-9A-Z\-. $/+%]+$/, 'CODE39 value', 'must use the CODE39 charset (0-9, A-Z, - . $ / + % space)');
      return;
    case BarcodeType.Code128:
      assertMatches(value, /^[\x20-\x7E]+$/, 'CODE128 value', 'must contain only printable ASCII characters');
      return;
    case BarcodeType.Itf:
      assertMatches(value, /^(\d{2})+$/, 'ITF value', 'must be an even number of digits');
      return;
    case BarcodeType.Codabar:
      assertMatches(value, /^[A-D]?[0-9\-$:/.+]+[A-D]?$/, 'CODABAR value', 'must use the CODABAR charset');
      return;
    default: {
      const exhaustive: never = barcodeType;
      throw new DocumentValidationError(`Unknown barcode type: ${String(exhaustive)}`);
    }
  }
}

export function createBarcodeElement(
  barcodeType: BarcodeType,
  value: string,
  options: BarcodeElementOptions = {},
): BarcodeElement {
  validateBarcodeValue(barcodeType, value);
  return {
    type: ElementType.Barcode,
    barcodeType,
    value,
    height: options.height,
    width: options.width,
    showText: options.showText,
    style: options.style,
  };
}
