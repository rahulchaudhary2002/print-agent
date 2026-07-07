import type { DocumentRenderer } from '../document-renderer.interface.js';
import { ElementType, type DocumentElement, type PrintDocument, type ResolvedStyle } from '../../interfaces/index.js';
import { resolveStyle } from '../../styles/index.js';
import { serializeDocument } from '../../builder/index.js';
import {
  renderBarcodeElement,
  renderCutElement,
  renderDividerElement,
  renderDrawerElement,
  renderFeedElement,
  renderQrCodeElement,
  renderTextElement,
} from './commands/index.js';
import { codePageCommand, FULL_CUT, INITIALIZE, printAndFeedCommand } from './constants/index.js';
import { BufferWriter } from './encoders/index.js';
import { FontManager } from './fonts/index.js';
import { renderImageElement } from './images/index.js';
import { renderTableElement } from './tables/index.js';
import { resolvePaperProfile, resolveRendererOptions } from './utils/index.js';
import type { EscPosRenderContext } from './utils/render-context.js';
import type { EscPosRendererOptions, ResolvedEscPosRendererOptions } from './utils/renderer-config.js';

const SUPPORTED_TYPES = new Set<ElementType>(Object.values(ElementType));

/** Minimal logging surface — deliberately not the concrete LoggerService, so this module never depends on services/. */
export interface RendererLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

const NOOP_LOGGER: RendererLogger = { info: () => {}, warn: () => {} };

/**
 * Converts a printer-independent PrintDocument into raw ESC/POS bytes. Knows the document
 * model and the ESC/POS protocol — nothing else. Never touches a driver, SQLite, or Fastify,
 * and never sends anything anywhere; `render()` just returns a Buffer.
 */
export class EscPosRenderer implements DocumentRenderer<Buffer> {
  private readonly options: ResolvedEscPosRendererOptions;
  private readonly fontManager: FontManager;
  private readonly logger: RendererLogger;
  private initialized = false;

  constructor(options: EscPosRendererOptions = {}, logger: RendererLogger = NOOP_LOGGER) {
    this.options = resolveRendererOptions(options);
    this.fontManager = new FontManager(resolvePaperProfile(this.options.paperWidth), this.options.codePage);
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    this.logger.info('EscPosRenderer initialized', {
      paperWidth: this.options.paperWidth,
      codePage: this.options.codePage,
    });
  }

  async destroy(): Promise<void> {
    this.initialized = false;
  }

  supports(element: DocumentElement): boolean {
    return SUPPORTED_TYPES.has(element.type);
  }

  async render(document: PrintDocument): Promise<Buffer> {
    if (!this.initialized) {
      throw new Error('EscPosRenderer.initialize() must be called before render()');
    }

    const startedAt = Date.now();
    const writer = new BufferWriter();
    const warnings: string[] = [];
    const context: EscPosRenderContext = {
      writer,
      fontManager: this.fontManager,
      options: this.options,
      warn: (message) => warnings.push(message),
    };

    writer.write(INITIALIZE);
    const codePageTableIndex = this.fontManager.codePageTableIndex;
    if (codePageTableIndex !== undefined) {
      writer.write(codePageCommand(codePageTableIndex));
    }

    let elementCount = 0;
    let endedWithCut = false;
    for (const section of document.sections) {
      for (const element of section.elements) {
        const style = resolveStyle(document.style, section.style, element.style);
        await this.renderElement(element, style, context);
        elementCount += 1;
        endedWithCut = element.type === ElementType.Cut;
      }
    }

    if (!endedWithCut && this.options.autoFeedLines > 0) {
      writer.write(printAndFeedCommand(this.options.autoFeedLines));
    }
    if (!endedWithCut && this.options.autoCut) {
      writer.write(FULL_CUT);
    }

    const buffer = writer.toBuffer();
    const durationMs = Date.now() - startedAt;

    this.logger.info('Document rendered', {
      sectionCount: document.sections.length,
      elementCount,
      documentBytes: Buffer.byteLength(serializeDocument(document)),
      bufferBytes: buffer.length,
      durationMs,
      warningCount: warnings.length,
    });
    for (const warning of warnings) {
      this.logger.warn(warning);
    }

    return buffer;
  }

  /** Dispatches one element to its command builder. Public per this phase's spec, not part of DocumentRenderer. */
  async renderElement(element: DocumentElement, style: ResolvedStyle, context: EscPosRenderContext): Promise<void> {
    switch (element.type) {
      case ElementType.Text:
        renderTextElement(element, style, context);
        return;
      case ElementType.Divider:
        renderDividerElement(element, style, context);
        return;
      case ElementType.Table:
        renderTableElement(element, style, context);
        return;
      case ElementType.QrCode:
        renderQrCodeElement(element, style, context);
        return;
      case ElementType.Barcode:
        renderBarcodeElement(element, style, context);
        return;
      case ElementType.Image:
        // A single bad/undecodable image shouldn't sink an otherwise-good receipt.
        try {
          await renderImageElement(element, style, context);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          context.warn(`Image could not be rendered and was skipped: ${reason}`);
        }
        return;
      case ElementType.Feed:
        renderFeedElement(element, context);
        return;
      case ElementType.Cut:
        renderCutElement(element, context);
        return;
      case ElementType.Drawer:
        renderDrawerElement(element, context);
        return;
      default: {
        const exhaustive: never = element;
        context.warn(`Unsupported element type: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}
