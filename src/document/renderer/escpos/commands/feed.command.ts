import type { FeedElement } from '../../../commands/index.js';
import { printAndFeedCommand } from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';

const MAX_FEED_LINES_PER_COMMAND = 255;

/** `ESC d n` only takes a single byte, so feeds beyond 255 lines are split across commands. */
export function renderFeedElement(element: FeedElement, context: EscPosRenderContext): void {
  let remaining = element.lines;
  while (remaining > 0) {
    const chunk = Math.min(remaining, MAX_FEED_LINES_PER_COMMAND);
    context.writer.write(printAndFeedCommand(chunk));
    remaining -= chunk;
  }
}
