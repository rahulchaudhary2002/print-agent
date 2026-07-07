import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import type { ElementStyle } from '../interfaces/style.types.js';
import { assertPositiveInteger } from '../interfaces/validation.util.js';
import { DocumentValidationError } from '../interfaces/document-error.js';

const DEFAULT_CHARACTER = '-';
const DEFAULT_LENGTH = 32;

export interface DividerElement extends BaseElement {
  type: ElementType.Divider;
  character: string;
  length: number;
}

export interface DividerElementOptions {
  character?: string | undefined;
  length?: number | undefined;
  style?: ElementStyle | undefined;
}

/** e.g. `createDividerElement({ character: '=', length: 24 })` → `========================` */
export function createDividerElement(options: DividerElementOptions = {}): DividerElement {
  const character = options.character ?? DEFAULT_CHARACTER;
  const length = options.length ?? DEFAULT_LENGTH;

  if (character.length !== 1) {
    throw new DocumentValidationError('Divider character must be exactly one character');
  }
  assertPositiveInteger(length, 'Divider length');

  return { type: ElementType.Divider, character, length, style: options.style };
}
