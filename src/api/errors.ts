// The API's error shape (ADR 0052, "API conventions"): `{ error: { code, message } }` with the
// right HTTP status. The client branches on `code`; `message` is for people and logs.

export const ERROR_CODES = [
  /** This deploy has online play switched off (production, until launch). */
  'online_off',
  'not_found',
  'method_not_allowed',
  /** A non-GET request from another origin, or without a JSON body (the CSRF check). */
  'forbidden_origin',
  'unsupported_media_type',
  'bad_request',
  /** No session, or one that can't be refreshed: the player needs to start (or restart) a guest. */
  'unauthenticated',
  /** The 16+ confirmation is missing from a guest's first online action. */
  'age_unconfirmed',
  'rate_limited',
  /** Supabase Auth refused to make another guest for now (its own per-IP limit). */
  'guests_busy',
  /** A pick that isn't this side's to make now (not its turn, a stale tab, a finished series). */
  'not_your_turn',
  'conflict',
  /** A live pick before its pick phase opens: the fight before it is still on (ADR 0053). */
  'too_early',
  /** The player is already in a live match or waiting in a lobby: one at a time (ADR 0053). */
  'in_a_match',
  'challenge_taken',
  'challenge_expired',
  /** A live link whose sender stopped waiting (cancelled, or left the lobby, ADR 0053). */
  'challenge_stopped',
  'own_challenge',
  'too_many_series',
  /** A rematch that can't be asked or answered now: declined, out of time, or never offered. */
  'rematch_closed',
  /** This deploy has accounts switched off (ADR 0079): sign-in isn't offered. */
  'accounts_off',
  /** The player is signed in to an account already: sign-in is for guests and new devices. */
  'already_signed_in',
  /** Email codes are switched off for now, or today's or this month's are used up (ADR 0079). */
  'email_busy',
  /** An address Auth won't send to. */
  'bad_email',
  /** A code that is wrong, expired, or tried too often. */
  'wrong_code',
  /** A sign-in step with nothing started on this device (its 10 minutes ran out). */
  'sign_in_expired',
  /** The series names a ruleset whose frozen bundle this server doesn't have. */
  'ruleset_missing',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorBody {
  readonly error: { readonly code: ErrorCode; readonly message: string };
}

/** The error in a response body, if it is one of ours; anything else is undefined. */
export function errorOf(body: unknown): ErrorBody['error'] | undefined {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
  const { error } = body;
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, message } = error as Record<string, unknown>;
  if (typeof message !== 'string') return undefined;
  const known = ERROR_CODES.find((candidate) => candidate === code);
  return known === undefined ? undefined : { code: known, message };
}
