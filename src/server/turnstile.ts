// Cloudflare Turnstile's server check (ADR 0079 addendum of 2026-11-28): the token a page's widget
// gave is sent to `siteverify` with our secret before a device's first email code is counted. Auth's
// own captcha setting stays off: it is project-wide, so it would ask every new guest for a token.
// A token is single-use and lasts 300 s; one checked here can't be checked again by anyone.
import { CAPTCHA_ACTION } from '../api/accounts.ts';
import type { TurnstileKeys } from './config.ts';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The widget's action on the sign-in screen: a token made for anything else is refused. */
export const TURNSTILE_ACTION = CAPTCHA_ACTION;

/** How long Cloudflare gets to answer: a slow answer is "try again", never a code unchecked. */
export const SITEVERIFY_TIMEOUT_MS = 3000;

/**
 * Cloudflare's documented test secrets (always passes, always fails, already spent). They answer
 * for any token, with the hostname `example.com` and no action, so those two aren't checked under
 * them; a real secret never matches.
 */
const TEST_SECRET = /^[123]x0{31}AA$/;

/** Answers that are our secret's fault or Cloudflare's own, never the player's token. */
const NOT_THE_PLAYERS = new Set(['missing-input-secret', 'invalid-input-secret', 'internal-error']);

/**
 * What the check found: passed; refused (the token is missing, wrong, spent, expired or made for
 * another site or action: the player tries again with a new one); or unavailable (Cloudflare out of
 * reach, slow, failing, or refusing our secret: reported, and the player tries again later).
 * `detail` is safe to log: never the token or the secret.
 */
export type TurnstileVerdict =
  | { readonly kind: 'passed' }
  | { readonly kind: 'refused'; readonly detail: string }
  | { readonly kind: 'unavailable'; readonly detail: string };

export interface TurnstileRequest {
  /** The widget's token, as the page sent it (`decodeSendCode`), if it sent one. */
  readonly token: string | undefined;
  /** The player's IP, as Netlify saw it: Cloudflare weighs it, nothing keeps it here. */
  readonly ip: string | undefined;
  /** The site the request came to (`new URL(request.url).hostname`): the widget's must match. */
  readonly hostname: string;
}

const field = (body: unknown, name: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;

/** Checks a widget's token with Cloudflare. Never throws. */
export async function verifyTurnstile(
  keys: TurnstileKeys,
  request: TurnstileRequest,
  send: typeof fetch = fetch,
): Promise<TurnstileVerdict> {
  const { token } = request;
  if (token === undefined) return { kind: 'refused', detail: 'no token' };
  const form = new URLSearchParams({ secret: keys.secret, response: token });
  if (request.ip !== undefined) form.set('remoteip', request.ip);
  let body: unknown;
  try {
    const response = await send(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { kind: 'unavailable', detail: `siteverify answered ${String(response.status)}` };
    }
    body = await response.json();
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    return { kind: 'unavailable', detail: `siteverify unreachable (${name})` };
  }
  const codes = field(body, 'error-codes');
  const errors = Array.isArray(codes) ? codes.filter((code) => typeof code === 'string') : [];
  if (errors.some((code) => NOT_THE_PLAYERS.has(code))) {
    return { kind: 'unavailable', detail: `siteverify: ${errors.join(', ')}` };
  }
  if (field(body, 'success') !== true) {
    return { kind: 'refused', detail: `siteverify: ${errors.join(', ') || 'not a success'}` };
  }
  if (TEST_SECRET.test(keys.secret)) return { kind: 'passed' };
  if (field(body, 'hostname') !== request.hostname) {
    return { kind: 'refused', detail: 'token made for another site' };
  }
  if (field(body, 'action') !== TURNSTILE_ACTION) {
    return { kind: 'refused', detail: 'token made for another action' };
  }
  return { kind: 'passed' };
}
