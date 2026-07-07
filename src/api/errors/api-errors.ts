import { AppError } from '../../utils/index.js';

/** A request body/query/params failed Zod validation. */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

/** The client wasn't allowed to make this request at all (e.g. non-localhost without `allowRemote`). */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/** Missing/invalid API key+secret when `requireApiKey` is enabled. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/** Too many requests within the configured rate-limit window. */
export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitedError';
  }
}
