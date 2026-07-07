import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import { assertPositiveInteger } from '../interfaces/validation.util.js';

/** Advances the paper by a number of lines — a printer action, not visible content. */
export interface FeedElement extends BaseElement {
  type: ElementType.Feed;
  lines: number;
}

export function createFeedElement(lines = 1): FeedElement {
  assertPositiveInteger(lines, 'Feed lines');
  return { type: ElementType.Feed, lines };
}
