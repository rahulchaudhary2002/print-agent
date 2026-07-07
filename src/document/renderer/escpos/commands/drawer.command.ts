import type { DrawerElement } from '../../../commands/index.js';
import { cashDrawerCommand } from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';

export function renderDrawerElement(element: DrawerElement, context: EscPosRenderContext): void {
  context.writer.write(cashDrawerCommand(element.pin, element.durationMs, element.durationMs));
}
