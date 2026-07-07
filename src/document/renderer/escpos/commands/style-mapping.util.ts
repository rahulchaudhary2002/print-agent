import { TextAlignment } from '../../../interfaces/index.js';

/** Shared by every command builder that needs an ESC/POS alignment parameter (0/1/2). */
export function resolveAlignmentCode(align: TextAlignment): 0 | 1 | 2 {
  if (align === TextAlignment.Center) return 1;
  if (align === TextAlignment.Right) return 2;
  return 0;
}
