// What a newcomer has already been shown (ADR 0036), remembered on their device: the balls whose
// ability hint has shown, how many versus cards they've seen, and whether tips are on at all.
// Storage can be missing or throw (private windows, blocked site data); then tips still work for
// this page load and are simply shown again next time.

export const TIPS_STORAGE_KEY = 'ballbattle.tips';
export const HINTS_SEEN_STORAGE_KEY = 'ballbattle.hintsSeen';
export const VERSUS_SEEN_STORAGE_KEY = 'ballbattle.versusSeen';

/** The versus card shows for a player's first few matches, then never again. */
export const VERSUS_MATCHES = 3;

export type TipStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Tips {
  /** Off means no hints and no versus card. */
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** True the first time this device sees `ballId`'s ability; marks it seen. */
  takeHint(ballId: string): boolean;
  /** True for a player's first VERSUS_MATCHES matches; counts this one. */
  takeVersus(): boolean;
  /** Shows every hint and the versus card again, and turns tips on. */
  reset(): void;
}

function read(storage: TipStorage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: TipStorage, key: string, value: string | undefined): void {
  try {
    if (value === undefined) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Not remembered this time: the tip is simply shown again on the next visit.
  }
}

export function createTips(storage: TipStorage): Tips {
  // Kept in memory too, so a hint never repeats within a page load even when storage fails.
  let on = read(storage, TIPS_STORAGE_KEY) !== 'off';
  const seen = new Set(
    (read(storage, HINTS_SEEN_STORAGE_KEY) ?? '').split(',').filter((id) => id !== ''),
  );
  const stored = Number(read(storage, VERSUS_SEEN_STORAGE_KEY));
  let versus = Number.isInteger(stored) && stored > 0 ? stored : 0;
  return {
    enabled: () => on,
    setEnabled(next) {
      on = next;
      write(storage, TIPS_STORAGE_KEY, next ? undefined : 'off');
    },
    takeHint(ballId) {
      if (!on || seen.has(ballId)) return false;
      seen.add(ballId);
      write(storage, HINTS_SEEN_STORAGE_KEY, [...seen].join(','));
      return true;
    },
    takeVersus() {
      if (!on || versus >= VERSUS_MATCHES) return false;
      versus += 1;
      write(storage, VERSUS_SEEN_STORAGE_KEY, String(versus));
      return true;
    },
    reset() {
      seen.clear();
      versus = 0;
      on = true;
      write(storage, HINTS_SEEN_STORAGE_KEY, undefined);
      write(storage, VERSUS_SEEN_STORAGE_KEY, undefined);
      write(storage, TIPS_STORAGE_KEY, undefined);
    },
  };
}
