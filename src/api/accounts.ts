// Accounts (ADR 0079): signing in with Google or an email code, a guest linked to the same user id.
// What the page and the API say to each other; the browser never talks to Supabase or Google but
// through `/api/v1/auth/*`.

/** GET /api/v1/auth/options: the ways in this deploy offers. */
export interface AuthOptions {
  /** Google is set up here (staging and local; never a deploy preview, whose address changes). */
  readonly google: boolean;
  /** Email codes are on (the owner can switch them off for a while, ADR 0079). */
  readonly emailCodes: boolean;
}

/** POST /api/v1/auth/email: send a code. */
export interface SendCodeRequest {
  readonly email: string;
  /**
   * The 16+ confirmation, from a device without a guest: an email new to us makes a player. A
   * guest confirmed it already.
   */
  readonly adult?: true;
  /**
   * Turnstile's token (ADR 0079 addendum of 2026-11-28), where the build has the widget: a device's
   * first code to an address needs one; sending the same address again within the code's 10 minutes
   * doesn't. Checked by the server only.
   */
  readonly captcha?: string;
}

/** The Turnstile widget's action on the sign-in screen: the server refuses a token made for another. */
export const CAPTCHA_ACTION = 'email-code';

/** The longest Turnstile token a page may send (Cloudflare's own limit). */
const MAX_CAPTCHA = 2048;

/** POST /api/v1/auth/email/verify. */
export interface VerifyCodeRequest {
  readonly code: string;
}

/**
 * The end of a sign-in: signed in (a guest linked, or an account on this device), or an email or a
 * Google account that already has an account, waiting for the player to switch to it.
 */
export interface SignInResponse {
  readonly outcome: 'signed_in' | 'switch';
}

/** The longest address Auth stores. */
const MAX_EMAIL = 254;
/** One @, something either side, a dot in the domain, no spaces: Auth checks the rest. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address as we keep and count it (trimmed, lower case), or undefined if it can't be one. */
export function normalEmail(text: string): string | undefined {
  const email = text.trim().toLowerCase();
  return email.length <= MAX_EMAIL && EMAIL.test(email) ? email : undefined;
}

/** The body of POST /api/v1/auth/email, if it is one. */
export function decodeSendCode(body: unknown): SendCodeRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { email, adult, captcha } = body as Record<string, unknown>;
  const normal = typeof email === 'string' ? normalEmail(email) : undefined;
  if (normal === undefined) return undefined;
  return {
    email: normal,
    ...(adult === true ? { adult } : {}),
    ...(typeof captcha === 'string' && captcha !== '' && captcha.length <= MAX_CAPTCHA
      ? { captcha }
      : {}),
  };
}

/** A code as Auth sends it: 6 digits. Spaces a phone's paste may add are dropped. */
export function normalCode(text: string): string | undefined {
  const code = text.replace(/\s+/g, '');
  return /^\d{6}$/.test(code) ? code : undefined;
}

/** The body of POST /api/v1/auth/email/verify, if it is one. */
export function decodeVerifyCode(body: unknown): VerifyCodeRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { code } = body as Record<string, unknown>;
  const normal = typeof code === 'string' ? normalCode(code) : undefined;
  return normal === undefined ? undefined : { code: normal };
}

/**
 * Where Google's callback sends the page back (`?view=signin&google=<result>`): signed in, an
 * existing account to switch to, or why not.
 */
export const GOOGLE_RESULTS = [
  'signed_in',
  'switch',
  /** The player cancelled at Google, or Google refused. */
  'cancelled',
  /** The sign-in took longer than 10 minutes, was started elsewhere, or its link was reused. */
  'expired',
  'in_a_match',
  'failed',
] as const;

export type GoogleResult = (typeof GOOGLE_RESULTS)[number];

export const isGoogleResult = (value: unknown): value is GoogleResult =>
  GOOGLE_RESULTS.some((result) => result === value);

/** What a username may be, in the words the server refuses with and the page shows (ADR 0079). */
export const USERNAME_RULE = 'Letters a–z, numbers and _ only, 3–15 characters';

/** PUT /api/v1/me/username: choose a username (an account only; the server checks it all). */
export interface UsernameRequest {
  readonly username: string;
}

/** The answer to choosing one: the username as kept. */
export interface UsernameResponse {
  readonly username: string;
}

/** The body of PUT /api/v1/me/username, if it is one: the name as typed, trimmed. */
export function decodeUsername(body: unknown): UsernameRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { username } = body as Record<string, unknown>;
  return typeof username === 'string' && username.length <= 64
    ? { username: username.trim() }
    : undefined;
}
