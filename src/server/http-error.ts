// An answer that isn't a success, in the API's error shape (src/api/errors.ts). Its own module, so
// failure.ts can name it without importing the route frame.
import type { ErrorCode } from '../api/errors.ts';

/** An answer that isn't a success: thrown by a route, sent as `{ error: { code, message } }`. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: ErrorCode;
  readonly headers: Readonly<Record<string, string>>;
  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}
