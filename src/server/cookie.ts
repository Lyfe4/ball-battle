// The session cookie (ADR 0052, section 6 item 2): `__Host-bb_session`, HttpOnly, Secure,
// SameSite=Lax, Path=/ and no Domain (the `__Host-` prefix requires the last three). It holds the
// Supabase access and refresh tokens, so no token is ever readable by the page's JavaScript.

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
