// What every route checks of a request before anything else (ADR 0052, section 6 item 2):
// - CSRF: a request that changes anything must come from the site itself (`Origin`), and a body
//   must be `application/json`, which a cross-site form can't send without a preflight we never
//   answer. The session cookie is SameSite=Lax as well.
// - The method is one the route serves.
// - A body is small JSON (no route takes more than a lineup).
import { ApiError } from './http.ts';

const SAFE = new Set(['GET', 'HEAD']);
const MAX_BODY_BYTES = 4096;

/** Refuses a request whose method isn't one of `allowed`, or that fails the CSRF check. */
export function guard(request: Request, allowed: readonly string[]): void {
  if (!allowed.includes(request.method)) {
    throw new ApiError(405, 'method_not_allowed', `Use ${allowed.join(' or ')}`, {
      Allow: allowed.join(', '),
    });
  }
  if (SAFE.has(request.method)) return;
  const origin = request.headers.get('Origin');
  if (origin === null || origin !== new URL(request.url).origin) {
    throw new ApiError(403, 'forbidden_origin', 'This request must come from the game itself');
  }
}

/** The JSON body of a request that changes something; refuses anything else. */
export async function jsonBody(request: Request): Promise<unknown> {
  const type = request.headers.get('Content-Type') ?? '';
  if (!/^application\/json\s*(?:;|$)/i.test(type)) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the body as application/json');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new ApiError(400, 'bad_request', 'The body is too large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'bad_request', 'The body is not JSON');
  }
}
