// The session cookie (ADR 0052, section 6 item 2): `__Host-bb_session`, HttpOnly, Secure,
// SameSite=Lax, Path=/ and no Domain (the `__Host-` prefix requires the last three). It holds the
// Supabase access and refresh tokens, so no token is ever readable by the page's JavaScript.
// Beside it, `__Host-bb_player=1` (ADR 0079 addendum of 2026-11-22): readable by the page and
// holding nothing but "this device has a player", so home asks `/me` only on a device that has
// one. It is set and cleared with the session cookie, and set again by every `/me` read. Set by
// the server, so Safari's 7-day cap on script storage doesn't reach it.
import { PLAYER_HINT_COOKIE } from '../api/session.ts';

export const SESSION_COOKIE = '__Host-bb_session';
/** How long a browser keeps a guest: the most Chrome allows (400 days), renewed on each refresh. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const ATTRIBUTES = 'Path=/; HttpOnly; Secure; SameSite=Lax';

export interface SessionTokens {
  readonly access: string;
  readonly refresh: string;
}

/** The value of one cookie in a `Cookie` header, if present. */
export function cookieValue(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

const TOKEN = /^[A-Za-z0-9._-]{1,4000}$/;

/** The tokens in a request's session cookie, if it holds well-formed ones. */
export function readSession(request: Request): SessionTokens | undefined {
  const value = cookieValue(request.headers.get('Cookie'), SESSION_COOKIE);
  if (value === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const { a, r } = parsed as Record<string, unknown>;
  if (typeof a !== 'string' || typeof r !== 'string' || !TOKEN.test(a) || !TOKEN.test(r)) {
    return undefined;
  }
  return { access: a, refresh: r };
}

/** The `Set-Cookie` value that stores these tokens. */
export function sessionCookie(tokens: SessionTokens): string {
  const json = JSON.stringify({ a: tokens.access, r: tokens.refresh });
  const value = Buffer.from(json).toString('base64url');
  return `${SESSION_COOKIE}=${value}; ${ATTRIBUTES}; Max-Age=${String(MAX_AGE_SECONDS)}`;
}

/** The `Set-Cookie` value that removes the session. */
export const clearedSessionCookie = (): string => `${SESSION_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;

const HINT_ATTRIBUTES = 'Path=/; Secure; SameSite=Lax';

/** The `Set-Cookie` value that tells the page this device has a player. */
export const playerHintCookie = (): string =>
  `${PLAYER_HINT_COOKIE}=1; ${HINT_ATTRIBUTES}; Max-Age=${String(MAX_AGE_SECONDS)}`;

/** The `Set-Cookie` value that removes the hint. */
export const clearedPlayerHintCookie = (): string =>
  `${PLAYER_HINT_COOKIE}=; ${HINT_ATTRIBUTES}; Max-Age=0`;

/**
 * A response's cookies with the hint following the session: set with it, cleared with it (the
 * last session cookie decides). Answers that leave the session alone leave the hint alone.
 */
export function withPlayerHint(cookies: readonly string[]): string[] {
  const session = cookies.findLast((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  const rest = cookies.filter((cookie) => !cookie.startsWith(`${PLAYER_HINT_COOKIE}=`));
  if (session === undefined) return [...cookies];
  const cleared = session.endsWith('Max-Age=0');
  return [...rest, cleared ? clearedPlayerHintCookie() : playerHintCookie()];
}
