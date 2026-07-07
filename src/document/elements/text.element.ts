import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import type { ElementStyle } from '../interfaces/style.types.js';
import { assertNonEmptyString } from '../interfaces/validation.util.js';

export enum TextEncoding {
  Utf8 = 'utf-8',
  Ascii = 'ascii',
  // Code pages (e.g. CP437, CP852) are a future renderer concern — not implemented yet.
}

export interface TextElement extends BaseElement {
  type: ElementType.Text;
  content: string;
  encoding: TextEncoding;
  width?: number | undefined;
}

export interface TextElementOptions {
  style?: ElementStyle | undefined;
  encoding?: TextEncoding | undefined;
  width?: number | undefined;
}

export function createTextElement(content: string, options: TextElementOptions = {}): TextElement {
  assertNonEmptyString(content, 'Text content');
  return {
    type: ElementType.Text,
    content,
    encoding: options.encoding ?? TextEncoding.Utf8,
    width: options.width,
    style: options.style,
  };
}
