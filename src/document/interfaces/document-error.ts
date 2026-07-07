import { AppError } from '../../utils/index.js';

/** Raised when a document, section, or element fails validation while being built or deserialized. */
export class DocumentValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'DocumentValidationError';
  }
}
