// Friends (ADR 0079, PR (c)): what the page and the API say to each other about an account's
// friends and friend requests. Accounts only; a friendship is named by its own id, never a player's.

/** A friend, or the other side of a request. */
export interface FriendEntry {
  /** The friendship's id: what accept and remove name. */
  readonly id: string;
  /** The name everyone sees: the username, else "Player 1234". */
  readonly name: string;
}

/** GET /api/v1/friends, and the answer to every change. */
export interface FriendsResponse {
  /** This account's friend code, 8 characters ("7KQ2M9XD"), shown as "7KQ2-M9XD". */
  readonly code: string;
  readonly friends: readonly FriendEntry[];
  /** Requests to this account, waiting for its answer. */
  readonly incoming: readonly FriendEntry[];
  /** Requests this account sent that aren't answered yet (a declined one still reads as sent). */
  readonly outgoing: readonly FriendEntry[];
}

/** POST /api/v1/friends: a request to a username or a friend code, as typed. */
export interface AddFriendRequest {
  readonly to: string;
}

/** Its answer: sent, or friends at once (they had asked you), with the list as it now is. */
export interface AddFriendResponse extends FriendsResponse {
  readonly outcome: 'requested' | 'friends';
  /** Who it went to, as everyone sees them. */
  readonly name: string;
}

/** Crockford's base32: no I, L, O or U, so a code read aloud or copied by hand can't be misread. */
export const FRIEND_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const FRIEND_CODE_LENGTH = 8;

/** A stored code: FRIEND_CODE_LENGTH characters of FRIEND_CODE_ALPHABET. */
const FRIEND_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** The longest thing worth looking up: a 15-character username, or a code with a dash and spaces. */
const MAX_TO = 20;

/**
 * A friend code as typed ("7kq2-m9xd", "7KQ2 M9XO"), as stored: upper case, without dashes or
 * spaces, the letters Crockford reads as digits (I and L as 1, O as 0) mapped. Undefined when it
 * can't be one.
 */
export function normalFriendCode(text: string): string | undefined {
  const code = text
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  return FRIEND_CODE.test(code) ? code : undefined;
}

/** "7KQ2M9XD" as shown: "7KQ2-M9XD". */
export function shownFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The body of POST /api/v1/friends, if it is one: trimmed, not empty, not too long. */
export function decodeAddFriend(body: unknown): AddFriendRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { to } = body as Record<string, unknown>;
  if (typeof to !== 'string') return undefined;
  const trimmed = to.trim();
  return trimmed.length === 0 || trimmed.length > MAX_TO ? undefined : { to: trimmed };
}

/** A friendship's id in a path: a UUID. */
export function isFriendshipId(text: string | undefined): text is string {
  return (
    text !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(text)
  );
}
