// Calls to the game's own API (ADR 0052): same origin only (`connect-src 'self'`), JSON both ways,
// the session in an HttpOnly cookie the page never sees. Every answer is one of three things the
// screens can show: the body, our error (`{ error: { code, message } }`), or "offline" when the
// request never reached the server, so no online screen is ever left without a way on.
import { errorOf, type ErrorCode } from '../api/errors.ts';

export type ApiResult<T> =
  | { readonly ok: true; readonly status: number; readonly body: T; readonly etag: string | null }
  | { readonly ok: false; readonly kind: 'offline' }
  | {
      readonly ok: false;
      readonly kind: 'error';
      readonly status: number;
      readonly code: ErrorCode | undefined;
      readonly message: string;
    };

/** What the page calls the API with; tests give their own. */
export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 15_000;

/**
 * `method path` with an optional JSON body. A 304 (the copy in hand is current) is `ok` with no
 * body. A network failure, a timeout or a browser that says it is offline is `offline`.
 */
export async function callApi<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Readonly<Record<string, string>> = {},
  send: Fetch = (input, init) => fetch(input, init),
): Promise<ApiResult<T | undefined>> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, kind: 'offline' };
  let response: Response;
  try {
    response = await send(`/api/v1/${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: 'offline' };
  }
  const text = response.status === 204 || response.status === 304 ? '' : await response.text();
  let parsed: unknown;
  try {
    parsed = text === '' ? undefined : JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (response.ok || response.status === 304) {
    return {
      ok: true,
      status: response.status,
      body: parsed as T | undefined,
      etag: response.headers.get('ETag'),
    };
  }
  const error = errorOf(parsed);
  return {
    ok: false,
    kind: 'error',
    status: response.status,
    code: error?.code,
    message: error?.message ?? 'Something went wrong',
  };
}
