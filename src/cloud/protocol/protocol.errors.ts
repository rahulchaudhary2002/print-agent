import { AppError } from '../../utils/index.js';

/** A message from the server failed envelope or payload validation — never trusted, never acted on. */
export class CloudProtocolError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'CloudProtocolError';
  }
}
