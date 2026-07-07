import type { CutElement, DrawerElement, FeedElement } from '../commands/index.js';
import type {
  BarcodeElement,
  DividerElement,
  ImageElement,
  QrCodeElement,
  TableElement,
  TextElement,
} from '../elements/index.js';

/**
 * Every kind of node that can appear in a Section. Lives here (not in base-element.interface.ts)
 * so elements/commands can depend on the base contract without importing this file back —
 * avoids a cycle between interfaces/ and elements|commands/.
 */
export type DocumentElement =
  | TextElement
  | DividerElement
  | TableElement
  | QrCodeElement
  | BarcodeElement
  | ImageElement
  | FeedElement
  | CutElement
  | DrawerElement;
