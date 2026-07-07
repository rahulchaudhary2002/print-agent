import { BarcodeType, type BarcodeElement } from '../../../elements/index.js';
import type { ResolvedStyle } from '../../../interfaces/index.js';
import {
  alignmentCommand,
  barcodeCommand,
  barcodeHeightCommand,
  barcodeHriPositionCommand,
  barcodeWidthCommand,
  BARCODE_TYPE_CODE,
} from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { resolveAlignmentCode } from './style-mapping.util.js';

const DEFAULT_HEIGHT_DOTS = 80;
const DEFAULT_WIDTH_DOTS_PER_MODULE = 2;

const TYPE_CODE: Record<BarcodeType, number> = {
  [BarcodeType.Upc]: BARCODE_TYPE_CODE.UPC_A,
  [BarcodeType.Ean13]: BARCODE_TYPE_CODE.EAN13,
  [BarcodeType.Ean8]: BARCODE_TYPE_CODE.EAN8,
  [BarcodeType.Code39]: BARCODE_TYPE_CODE.CODE39,
  [BarcodeType.Itf]: BARCODE_TYPE_CODE.ITF,
  [BarcodeType.Codabar]: BARCODE_TYPE_CODE.CODABAR,
  [BarcodeType.Code128]: BARCODE_TYPE_CODE.CODE128,
};

export function renderBarcodeElement(element: BarcodeElement, style: ResolvedStyle, context: EscPosRenderContext): void {
  const { writer } = context;
  const data = Buffer.from(element.value, 'ascii');

  writer.write(alignmentCommand(resolveAlignmentCode(style.align)));
  writer.write(barcodeHeightCommand(element.height ?? DEFAULT_HEIGHT_DOTS));
  writer.write(barcodeWidthCommand(element.width ?? DEFAULT_WIDTH_DOTS_PER_MODULE));
  writer.write(barcodeHriPositionCommand(element.showText ? 2 : 0));
  writer.write(barcodeCommand(TYPE_CODE[element.barcodeType], data));
}
