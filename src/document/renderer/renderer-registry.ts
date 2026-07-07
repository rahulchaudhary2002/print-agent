import type { DocumentRenderer } from './document-renderer.interface.js';

/**
 * `config` is whatever the caller's printer connection carries (paper width, code page, ...).
 * DocumentRenderer.initialize() takes no arguments, so per-instance configuration has to happen
 * here, at construction time — this is why the factory takes a config bag instead of being niladic.
 */
export type RendererFactoryFn = (config?: Record<string, unknown>) => DocumentRenderer;

/**
 * Maps renderer type identifiers (e.g. "escpos") to factory functions — the same registry
 * pattern as DriverRegistry, and the extension point for future renderers (PDF, HTML, image).
 */
export class RendererRegistry {
  private readonly factories = new Map<string, RendererFactoryFn>();

  register(rendererType: string, factory: RendererFactoryFn): void {
    this.factories.set(rendererType, factory);
  }

  unregister(rendererType: string): void {
    this.factories.delete(rendererType);
  }

  find(rendererType: string): RendererFactoryFn | undefined {
    return this.factories.get(rendererType);
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}
