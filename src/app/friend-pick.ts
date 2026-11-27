// The friend last picked in "Who do you want to play?" (ADR 0089), remembered on this device so the
// sheet lists them first next time. Play never goes straight to them (ADR 0089 addendum of
// 2026-11-27): nothing is sent before the sheet's button is tapped. It names the account that
// picked them, so another account on the same device never sees it (Log out clears every
// `ballbattle.*` key as well).

export const FRIEND_PICK_STORAGE_KEY = 'ballbattle.friendPick';

export interface FriendPick {
  /** The username of the account that picked them. */
  readonly owner: string;
  /** The friendship's id (`FriendEntry.id`). */
  readonly id: string;
  /** Their name when picked, for the box until the inbox says it again. */
  readonly name: string;
  /** By turns (ADR 0085); else live. */
  readonly turns: boolean;
}

type Storage = () => Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The pick `raw` holds, or undefined when it isn't one (never throws). */
export function parseFriendPick(raw: string | null): FriendPick | undefined {
  if (raw === null) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return undefined;
    const { owner, id, name, turns } = value as Record<string, unknown>;
    if (typeof owner !== 'string' || typeof id !== 'string' || typeof name !== 'string') {
      return undefined;
    }
    if (typeof turns !== 'boolean' || owner === '' || id === '') return undefined;
    return { owner, id, name, turns };
  } catch {
    return undefined;
  }
}

/**
 * `owner`'s remembered pick, if any (anyone's while who is signed in isn't known yet: Log out clears
 * it); storage that is missing or throws remembers none.
 */
export function loadFriendPick(
  storage: Storage,
  owner: string | undefined,
): FriendPick | undefined {
  let raw: string | null;
  try {
    raw = storage().getItem(FRIEND_PICK_STORAGE_KEY);
  } catch {
    return undefined;
  }
  const pick = parseFriendPick(raw);
  return owner === undefined || pick?.owner === owner ? pick : undefined;
}

export function saveFriendPick(storage: Storage, pick: FriendPick): void {
  try {
    storage().setItem(FRIEND_PICK_STORAGE_KEY, JSON.stringify(pick));
  } catch {
    // Not remembered this time: Play asks who next time.
  }
}
