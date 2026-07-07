import { CutType, type CutElement } from '../../../commands/index.js';
import { FULL_CUT, PARTIAL_CUT } from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';

export function renderCutElement(element: CutElement, context: EscPosRenderContext): void {
  context.writer.write(element.cutType === CutType.Partial ? PARTIAL_CUT : FULL_CUT);
}
