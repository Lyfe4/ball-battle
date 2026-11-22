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
}

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
  const { email, adult } = body as Record<string, unknown>;
  const normal = typeof email === 'string' ? normalEmail(email) : undefined;
  if (normal === undefined) return undefined;
  return adult === true ? { email: normal, adult } : { email: normal };
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
