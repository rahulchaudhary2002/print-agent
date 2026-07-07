import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import { assertInRange } from '../interfaces/validation.util.js';

const MAX_PULSE_DURATION_MS = 510; // ESC/POS pulse timing is specified in ~2ms increments up to 510ms.

/** Kicks a cash drawer — a printer action, not visible content. */
export interface DrawerElement extends BaseElement {
  type: ElementType.Drawer;
  /** Connector pin (0 or 1, mapping to pins 2/5 on most ESC/POS drawer kick cables). */
  pin: 0 | 1;
  durationMs: number;
}

export function createDrawerElement(pin: 0 | 1 = 0, durationMs = 120): DrawerElement {
  assertInRange(durationMs, 1, MAX_PULSE_DURATION_MS, 'Drawer pulse duration');
  return { type: ElementType.Drawer, pin, durationMs };
}
