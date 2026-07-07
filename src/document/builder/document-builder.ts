import { CutType, createCutElement, createDrawerElement, createFeedElement } from '../commands/index.js';
import {
  BarcodeType,
  createBarcodeElement,
  createDividerElement,
  createImageElement,
  createQrCodeElement,
  createTableElement,
  createTextElement,
  type BarcodeElementOptions,
  type DividerElementOptions,
  type ImageElementOptions,
  type ImageSource,
  type QrCodeElementOptions,
  type TableColumn,
  type TableElementOptions,
  type TableRow,
  type TextElementOptions,
} from '../elements/index.js';
import {
  CharacterSize,
  DocumentValidationError,
  FontFamily,
  TextAlignment,
  type DocumentElement,
  type ElementStyle,
  type PrintDocument,
  type Section,
} from '../interfaces/index.js';

/**
 * Fluent API for assembling a PrintDocument. Never generates bytes — only ever produces
 * the printer-independent document model; a renderer (not implemented yet) does the rest.
 *
 * Style-setting calls (alignCenter, bold, ...) affect elements added *after* them, not
 * retroactively — the builder tracks a running "current style" that each new element
 * captures a snapshot of.
 */
export class DocumentBuilder {
  private currentStyle: ElementStyle = {};
  private sections: Section[] = [];
  private currentSectionElements: DocumentElement[] = [];
  private currentSectionStyle: ElementStyle | undefined;
  private documentStyle: ElementStyle | undefined;
  private metadata: Record<string, unknown> | undefined;

  // ---- style state -------------------------------------------------------

  align(alignment: TextAlignment): this {
    this.currentStyle = { ...this.currentStyle, align: alignment };
    return this;
  }

  alignLeft(): this {
    return this.align(TextAlignment.Left);
  }

  alignCenter(): this {
    return this.align(TextAlignment.Center);
  }

  alignRight(): this {
    return this.align(TextAlignment.Right);
  }

  bold(enabled = true): this {
    this.currentStyle = { ...this.currentStyle, bold: enabled };
    return this;
  }

  underline(enabled = true): this {
    this.currentStyle = { ...this.currentStyle, underline: enabled };
    return this;
  }

  inverse(enabled = true): this {
    this.currentStyle = { ...this.currentStyle, inverse: enabled };
    return this;
  }

  font(family: FontFamily): this {
    this.currentStyle = { ...this.currentStyle, font: family };
    return this;
  }

  characterSize(size: CharacterSize): this {
    this.currentStyle = { ...this.currentStyle, characterSize: size };
    return this;
  }

  lineHeight(value: number): this {
    this.currentStyle = { ...this.currentStyle, lineHeight: value };
    return this;
  }

  letterSpacing(value: number): this {
    this.currentStyle = { ...this.currentStyle, letterSpacing: value };
    return this;
  }

  /** Clears the running style state back to "no overrides" for whatever comes next. */
  resetStyle(): this {
    this.currentStyle = {};
    return this;
  }

  // ---- document/section structure ----------------------------------------

  setDocumentStyle(style: ElementStyle): this {
    this.documentStyle = style;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  /** Closes the current section (if it has content) and starts a new one. */
  newSection(style?: ElementStyle): this {
    this.flushSection();
    this.currentSectionStyle = style;
    return this;
  }

  // ---- content elements ----------------------------------------------------

  text(content: string, options: Omit<TextElementOptions, 'style'> = {}): this {
    this.pushElement(createTextElement(content, { ...options, style: { ...this.currentStyle } }));
    return this;
  }

  divider(options: Omit<DividerElementOptions, 'style'> = {}): this {
    this.pushElement(createDividerElement({ ...options, style: { ...this.currentStyle } }));
    return this;
  }

  table(columns: TableColumn[], rows: TableRow[], options: Omit<TableElementOptions, 'style'> = {}): this {
    this.pushElement(createTableElement(columns, rows, { ...options, style: { ...this.currentStyle } }));
    return this;
  }

  qrcode(content: string, options: Omit<QrCodeElementOptions, 'style'> = {}): this {
    this.pushElement(createQrCodeElement(content, { ...options, style: { ...this.currentStyle } }));
    return this;
  }

  barcode(barcodeType: BarcodeType, value: string, options: Omit<BarcodeElementOptions, 'style'> = {}): this {
    this.pushElement(createBarcodeElement(barcodeType, value, { ...options, style: { ...this.currentStyle } }));
    return this;
  }

  image(source: ImageSource, options: Omit<ImageElementOptions, 'style'> = {}): this {
    this.pushElement(createImageElement(source, { ...options, style: { ...this.currentStyle } }));
    return this;
  }

  // ---- printer actions -------------------------------------------------

  feed(lines = 1): this {
    this.pushElement(createFeedElement(lines));
    return this;
  }

  cut(cutType: CutType = CutType.Full): this {
    this.pushElement(createCutElement(cutType));
    return this;
  }

  drawer(pin: 0 | 1 = 0, durationMs = 120): this {
    this.pushElement(createDrawerElement(pin, durationMs));
    return this;
  }

  // ---- finalization -------------------------------------------------------

  build(): PrintDocument {
    this.flushSection();
    if (this.sections.length === 0) {
      throw new DocumentValidationError('Document must contain at least one section with content');
    }
    return { sections: this.sections, style: this.documentStyle, metadata: this.metadata };
  }

  private pushElement(element: DocumentElement): void {
    this.currentSectionElements.push(element);
  }

  private flushSection(): void {
    if (this.currentSectionElements.length > 0 || this.currentSectionStyle !== undefined) {
      const section: Section = { elements: this.currentSectionElements, style: this.currentSectionStyle };
      this.sections.push(section);
      this.currentSectionElements = [];
      this.currentSectionStyle = undefined;
    }
  }
}
