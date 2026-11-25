// What this visit has read (ADR 0087, "What was read this visit shows at once on return"): who this
// device plays as (`/me`) and the Friends tab's list, kept in memory so a screen opened again shows
// them at once and refreshes in place. Never on the device: a reload starts it empty, so
// privacy.html doesn't change. Cleared when who the player is changes (a sign-in, a switch, Log out,
// Forget me), so nothing of one player shows to the next; the generation lets an answer that was
// asked before a clear be dropped when it lands after it.

/** A typed name for one thing kept. */
export interface VisitKey<T> {
  readonly name: string;
  /** Only for the type: never set. */
  readonly type?: T;
}

export interface VisitCache {
  read<T>(key: VisitKey<T>): T | undefined;
  write<T>(key: VisitKey<T>, value: T): void;
  /** Forgets everything (who the player is changed). */
  clear(): void;
  /** Counts the clears: an answer asked under one generation is kept only in the same one. */
  generation(): number;
}

export function createVisitCache(): VisitCache {
  const entries = new Map<string, unknown>();
  let clears = 0;
  return {
    read<T>(key: VisitKey<T>) {
      return entries.get(key.name) as T | undefined;
    },
    write(key, value) {
      entries.set(key.name, value);
    },
    clear() {
      entries.clear();
      clears += 1;
    },
    generation: () => clears,
  };
}

/** The page's one visit cache: a module in memory, gone with the page. */
export const visitCache: VisitCache = createVisitCache();
