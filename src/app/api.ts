// Calls to the game's own API (ADR 0052): same origin only (`connect-src 'self'`), JSON both ways,
// the session in an HttpOnly cookie the page never sees. Every answer is one of four things the
// screens can show: the body, our error (`{ error: { code, message } }`, or any other answer with
// an error status), "timeout" when the server took too long, or "offline" when the device is
// offline or the request got no response at all. A slow or failing server is never "offline".
import { errorOf, type ErrorCode } from '../api/errors.ts';
import { NOW_HEADER } from '../api/live.ts';
import type { ClockSample } from './live-clock.ts';

export type ApiResult<T> =
  | {
      readonly ok: true;
      readonly status: number;
      readonly body: T;
      readonly etag: string | null;
      /** A live series' answer: when it left, came back, and the server's clock (ADR 0053). */
      readonly clock: ClockSample | undefined;
    }
  | ApiFailure;

export type ApiFailure =
  | { readonly ok: false; readonly kind: 'offline' }
  | { readonly ok: false; readonly kind: 'timeout' }
  | {
      readonly ok: false;
      readonly kind: 'error';
      readonly status: number;
      readonly code: ErrorCode | undefined;
      readonly message: string;
    };

/**
 * What a failure means to the player: offline, the server too slow (`timeout`), the server failing
 * (`error`, a 5xx), or the request refused (`refused`, a 4xx: its message says why).
 */
export type FailureKind = 'offline' | 'timeout' | 'error' | 'refused';

export function failureKindOf(answer: ApiFailure): FailureKind {
  if (answer.kind !== 'error') return answer.kind;
  return answer.status >= 500 ? 'error' : 'refused';
}

/** What the page calls the API with; tests give their own. */
export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** Long enough for a cold function far from the database (~3 s on staging), short enough to say so. */
const TIMEOUT_MS = 15_000;

/**
 * `method path` with an optional JSON body. A 304 (the copy in hand is current) is `ok` with no
 * body. No answer within TIMEOUT_MS, headers and body, is `timeout`.
 */
export async function callApi<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Readonly<Record<string, string>> = {},
  send: Fetch = (input, init) => fetch(input, init),
): Promise<ApiResult<T | undefined>> {
  // Only an explicit false: a runtime without `onLine` (not a browser) isn't offline.
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    return { ok: false, kind: 'offline' };
  }
  // A plain timer, not AbortSignal.timeout (Safari 16+ only); only it aborts, so an abort is a timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);
  let response: Response;
  let text: string;
  const sentAt = Date.now();
  let receivedAt: number;
  try {
    response = await send(`/api/v1/${path}`, {
      method,
      credentials: 'same-origin',
      // Never the browser's cache: the page keeps its own ETags (a 304 it asked for comes back as
      // is), and a cached answer's X-Now would freeze a live page's clock (ADR 0061).
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    receivedAt = Date.now();
    text = response.status === 204 || response.status === 304 ? '' : await response.text();
  } catch {
    return { ok: false, kind: controller.signal.aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
  let parsed: unknown;
  try {
    parsed = text === '' ? undefined : JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (response.ok || response.status === 304) {
    const serverNow = Number(response.headers.get(NOW_HEADER) ?? Number.NaN);
    return {
      ok: true,
      status: response.status,
      body: parsed as T | undefined,
      etag: response.headers.get('ETag'),
      clock: Number.isFinite(serverNow) ? { sentAt, receivedAt, serverNow } : undefined,
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
