import { DocumentValidationError, type PrintDocument, type Section } from '../interfaces/index.js';

/**
 * A PrintDocument is already plain data (no functions, no class instances), so JSON
 * round-trips it losslessly — this just adds a validation pass on the way back in,
 * since parsed JSON is `unknown` until proven otherwise. Used for cloud/queue transport.
 */
export function serializeDocument(document: PrintDocument): string {
  return JSON.stringify(document);
}

export function deserializeDocument(json: string): PrintDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid JSON';
    throw new DocumentValidationError(`Document JSON could not be parsed: ${reason}`);
  }
  return assertIsPrintDocument(parsed);
}

function assertIsPrintDocument(value: unknown): PrintDocument {
  if (typeof value !== 'object' || value === null || !('sections' in value)) {
    throw new DocumentValidationError('Document JSON must be an object with a "sections" array');
  }
  const { sections } = value as { sections: unknown };
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new DocumentValidationError('Document must contain at least one section');
  }
  sections.forEach((section, index) => assertIsSection(section, index));
  return value as PrintDocument;
}

function assertIsSection(value: unknown, index: number): asserts value is Section {
  if (typeof value !== 'object' || value === null || !('elements' in value)) {
    throw new DocumentValidationError(`Section ${index} must be an object with an "elements" array`);
  }
  const { elements } = value as { elements: unknown };
  if (!Array.isArray(elements)) {
    throw new DocumentValidationError(`Section ${index} "elements" must be an array`);
  }
  elements.forEach((element, elementIndex) => {
    if (typeof element !== 'object' || element === null || typeof (element as { type?: unknown }).type !== 'string') {
      throw new DocumentValidationError(`Section ${index}, element ${elementIndex} is missing a valid "type"`);
    }
  });
}
