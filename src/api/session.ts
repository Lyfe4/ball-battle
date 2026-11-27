// Guests and their sessions (ADR 0052, section 2). A guest is made on the first online action only,
// with the player's confirmation that they are 16 or older (section 6).

/** POST /api/v1/session: make a guest, or keep the one this browser already has. */
export interface CreateGuestRequest {
  /** The player confirmed they are 16 or older. Required: false or absent is refused. */
  readonly adult: true;
}

/** The player as they see themselves: GET /api/v1/me, and the answer to creating a guest. */
export interface PlayerResponse {
  /** The name opponents see: the account's username, else "Player 4821". */
  readonly name: string;
  /** Signed in to an account (ADR 0079), rather than a guest. Absent where accounts are off. */
  readonly account?: boolean;
  /** The account's username, null until chosen (ADR 0079). Absent where accounts are off. */
  readonly username?: string | null;
  /**
   * An account that has finished an online series (ADR 0090 addendum): any device it signs in on
   * is past the guided first series. Absent where accounts are off, and for a guest.
   */
  readonly played?: boolean;
}

/**
 * A cookie beside the HttpOnly session, readable by the page, holding only `1`: this device has a
 * player (ADR 0079 addendum of 2026-11-22). Home asks `/me` only where it is set.
 */
export const PLAYER_HINT_COOKIE = '__Host-bb_player';

/** Whether a `document.cookie` string holds the player hint. */
export function hasPlayerHint(cookies: string): boolean {
  return cookies.split(';').some((part) => part.trim() === `${PLAYER_HINT_COOKIE}=1`);
}

/** The body of POST /api/v1/session, if it is one. */
export function decodeCreateGuest(body: unknown): CreateGuestRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  return (body as Record<string, unknown>)['adult'] === true ? { adult: true } : undefined;
}
