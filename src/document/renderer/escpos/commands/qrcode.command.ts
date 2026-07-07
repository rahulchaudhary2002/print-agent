import { QrErrorCorrectionLevel, type QrCodeElement } from '../../../elements/index.js';
import type { ResolvedStyle } from '../../../interfaces/index.js';
import {
  alignmentCommand,
  QR_PRINT_COMMAND,
  qrSelectModelCommand,
  qrSetErrorCorrectionCommand,
  qrSetSizeCommand,
  qrStoreDataCommand,
} from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { resolveAlignmentCode } from './style-mapping.util.js';

/** Most ESC/POS QR implementations reject payloads much beyond this even though the protocol allows more. */
const PRACTICAL_MAX_QR_BYTES = 700;

const ERROR_CORRECTION_CODE: Record<QrErrorCorrectionLevel, 48 | 49 | 50 | 51> = {
  [QrErrorCorrectionLevel.Low]: 48,
  [QrErrorCorrectionLevel.Medium]: 49,
  [QrErrorCorrectionLevel.Quartile]: 50,
  [QrErrorCorrectionLevel.High]: 51,
};

export function renderQrCodeElement(element: QrCodeElement, style: ResolvedStyle, context: EscPosRenderContext): void {
  const data = Buffer.from(element.content, 'utf-8');
  if (data.length > PRACTICAL_MAX_QR_BYTES) {
    context.warn(`QR code content is ${data.length} bytes; many printers reject payloads over ${PRACTICAL_MAX_QR_BYTES} bytes`);
  }

  const { writer } = context;
  writer.write(alignmentCommand(resolveAlignmentCode(style.align)));
  writer.write(qrSelectModelCommand(element.model));
  writer.write(qrSetSizeCommand(element.size));
  writer.write(qrSetErrorCorrectionCommand(ERROR_CORRECTION_CODE[element.errorCorrection]));
  writer.write(qrStoreDataCommand(data));
  writer.write(QR_PRINT_COMMAND);
}
