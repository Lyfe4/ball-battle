// Short-lived cookies a sign-in keeps between its steps (ADR 0079): Google's state, verifier and
// nonce; which email a code went to and by which path; an existing account waiting for "Switch to
// it?". Each is `__Host-` (HttpOnly, Secure, SameSite=Lax, Path=/), lasts 10 minutes, and is signed
// with an HMAC under the server's key, its name inside the signature, so the page can't write one
// and one can't stand in for another. The expiry inside it is the server's, beside the browser's
// Max-Age: a copy kept past it is refused.
import type { Config } from './config.ts';
import { cookieValue } from './cookie.ts';

const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';
/** How long a sign-in step waits: Auth's codes expire after 10 minutes too. */
export const SIGN_IN_SECONDS = 600;

/** A sealed cookie's own key, apart from every other use of the server key. */
function keyOf(config: Config) {
  return crypto.subtle.importKey(
    'raw',
    config.currentSeedKey.raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const messageOf = (name: string, body: string) =>
  new TextEncoder().encode(`ballbattle/cookie/v1\0${name}\0${body}`);

/** The `Set-Cookie` value holding `payload` as `name` for `seconds`, signed. */
export async function sealCookie(
  config: Config,
  name: string,
  payload: Readonly<Record<string, unknown>>,
  now: number = Date.now(),
  seconds: number = SIGN_IN_SECONDS,
): Promise<string> {
  const body = Buffer.from(JSON.stringify({ ...payload, x: now + seconds * 1000 })).toString(
    'base64url',
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', await keyOf(config), messageOf(name, body)),
  );
  const value = `${body}.${Buffer.from(mac).toString('base64url')}`;
  return `${name}=${value}; ${ATTRIBUTES}; Max-Age=${String(seconds)}`;
}

/** The `Set-Cookie` value that removes `name`. */
export const clearedCookie = (name: string): string => `${name}=; ${ATTRIBUTES}; Max-Age=0`;

/**
 * What the request's `name` cookie holds, if it is one we sealed and it hasn't expired; undefined
 * for a missing, altered, expired or foreign one.
 */
export async function openCookie(
  config: Config,
  request: Request,
  name: string,
  now: number = Date.now(),
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const value = cookieValue(request.headers.get('Cookie'), name);
  const [body, mac, extra] = (value ?? '').split('.');
  if (body === undefined || mac === undefined || extra !== undefined || body === '') {
    return undefined;
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    await keyOf(config),
    Buffer.from(mac, 'base64url'),
    messageOf(name, body),
  );
  if (!valid) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (typeof payload !== 'object' || payload === null) return undefined;
  const expires = (payload as Record<string, unknown>)['x'];
  return typeof expires === 'number' && expires > now
    ? (payload as Record<string, unknown>)
    : undefined;
}
