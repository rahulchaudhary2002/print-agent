/** Step 2 — every successful response takes this shape. */
export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

/** Step 2 — every error response takes this shape. */
export interface ErrorResponse {
  success: false;
  message: string;
  errors: string[];
}

export function success<T>(data: T, message = 'Success'): SuccessResponse<T> {
  return { success: true, message, data };
}

export function failure(message: string, errors: string[] = []): ErrorResponse {
  return { success: false, message, errors: errors.length > 0 ? errors : [message] };
}
