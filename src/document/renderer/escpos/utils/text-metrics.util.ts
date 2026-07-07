import { CharacterSize } from '../../../interfaces/index.js';

function isDoubleWidth(size: CharacterSize): boolean {
  return size === CharacterSize.DoubleWidth || size === CharacterSize.DoubleWidthHeight;
}

/** Column width of a string at a given character size — double-width glyphs cost 2 columns each. */
export function measureTextWidth(text: string, characterSize: CharacterSize = CharacterSize.Normal): number {
  return isDoubleWidth(characterSize) ? text.length * 2 : text.length;
}

/** Greedy word-wrap to `maxColumns`, accounting for double-width sizing; hard-breaks overlong words. */
export function wrapText(text: string, maxColumns: number, characterSize: CharacterSize = CharacterSize.Normal): string[] {
  const effectiveMax = Math.max(1, isDoubleWidth(characterSize) ? Math.floor(maxColumns / 2) : maxColumns);
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= effectiveMax) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
    let remaining = word;
    while (remaining.length > effectiveMax) {
      lines.push(remaining.slice(0, effectiveMax));
      remaining = remaining.slice(effectiveMax);
    }
    current = remaining;
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

/** Cuts `text` to fit `maxColumns`, replacing the tail with `marker` when it doesn't fit as-is. */
export function truncateText(text: string, maxColumns: number, marker = '…'): string {
  if (text.length <= maxColumns) {
    return text;
  }
  if (maxColumns <= marker.length) {
    return marker.slice(0, Math.max(0, maxColumns));
  }
  return text.slice(0, maxColumns - marker.length) + marker;
}
