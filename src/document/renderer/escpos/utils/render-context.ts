import type { BufferWriter } from '../encoders/buffer-writer.js';
import type { FontManager } from '../fonts/font-manager.js';
import type { ResolvedEscPosRendererOptions } from './renderer-config.js';

/** Threaded through every command builder — the shared tools needed to turn one element into bytes. */
export interface EscPosRenderContext {
  writer: BufferWriter;
  fontManager: FontManager;
  options: ResolvedEscPosRendererOptions;
  warn: (message: string) => void;
}
