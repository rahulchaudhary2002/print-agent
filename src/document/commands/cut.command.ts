import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';

export enum CutType {
  Full = 'full',
  Partial = 'partial',
}

/** Cuts the paper — a printer action, not visible content. */
export interface CutElement extends BaseElement {
  type: ElementType.Cut;
  cutType: CutType;
}

export function createCutElement(cutType: CutType = CutType.Full): CutElement {
  return { type: ElementType.Cut, cutType };
}
