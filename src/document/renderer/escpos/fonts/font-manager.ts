import { CharacterSize, FontFamily } from '../../../interfaces/index.js';
import { CODE_PAGE_TABLE_INDEX, CodePage } from '../encoders/code-pages.js';
import type { PaperProfile } from '../utils/paper-profile.js';

function isDoubleWidth(size: CharacterSize): boolean {
  return size === CharacterSize.DoubleWidth || size === CharacterSize.DoubleWidthHeight;
}

function isDoubleHeight(size: CharacterSize): boolean {
  return size === CharacterSize.DoubleHeight || size === CharacterSize.DoubleWidthHeight;
}

/**
 * Combines the paper profile and configured code page into the answers text rendering
 * actually needs: how many columns fit a given font/size, and which ESC/POS table index
 * to select for the active code page.
 */
export class FontManager {
  constructor(
    private readonly paperProfile: PaperProfile,
    private readonly codePage: CodePage,
  ) {}

  columnsFor(font: FontFamily, characterSize: CharacterSize = CharacterSize.Normal): number {
    const baseColumns = font === FontFamily.B ? this.paperProfile.columnsFontB : this.paperProfile.columnsFontA;
    return isDoubleWidth(characterSize) ? Math.floor(baseColumns / 2) : baseColumns;
  }

  get dotsPerLine(): number {
    return this.paperProfile.dotsPerLine;
  }

  get activeCodePage(): CodePage {
    return this.codePage;
  }

  /** `undefined` means "no ESC t command should be sent" (UTF-8 passthrough mode). */
  get codePageTableIndex(): number | undefined {
    return this.codePage === CodePage.Utf8 ? undefined : CODE_PAGE_TABLE_INDEX[this.codePage];
  }

  static widthMagnification(size: CharacterSize): number {
    return isDoubleWidth(size) ? 2 : 1;
  }

  static heightMagnification(size: CharacterSize): number {
    return isDoubleHeight(size) ? 2 : 1;
  }
}
