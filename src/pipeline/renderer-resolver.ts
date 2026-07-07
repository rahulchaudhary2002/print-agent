import { PrinterCapability } from '../printer/interfaces/index.js';

/**
 * Which renderer type a printer needs, inferred from its driver's declared capabilities —
 * not from the driver's name. A printer whose driver only reports `RawBytes` (e.g. RawPrinterDriver)
 * has no compatible renderer and `null` is returned; its jobs must already carry finished bytes.
 *
 * `PrinterCapability.EscPos`/`.Pdf` happen to equal the renderer type strings ('escpos'/'pdf')
 * used to register with RendererRegistry — intentional, not a coincidence to rely on blindly
 * elsewhere, so the mapping is still spelled out explicitly here.
 */
const CAPABILITY_TO_RENDERER_TYPE: ReadonlyArray<readonly [PrinterCapability, string]> = [
  [PrinterCapability.EscPos, 'escpos'],
  [PrinterCapability.Pdf, 'pdf'],
];

export function resolveRendererType(capabilities: readonly PrinterCapability[]): string | null {
  for (const [capability, rendererType] of CAPABILITY_TO_RENDERER_TYPE) {
    if (capabilities.includes(capability)) {
      return rendererType;
    }
  }
  return null;
}
