// What a newcomer has already been shown (ADR 0036, 0037), remembered on their device: the balls
// whose ability hint has shown, the pairings whose "what to watch" card has shown, and the two
// switches the settings menu shows (ADR 0040): ability hints, and what-to-watch cards. Storage can
// be missing or throw (private windows, blocked site data); then tips still work for this page load
// and are simply shown again next time.

/** 'off' while ability hints are off. Before ADR 0040 it turned the cards off too. */
export const TIPS_STORAGE_KEY = 'ballbattle.tips';
export const HINTS_SEEN_STORAGE_KEY = 'ballbattle.hintsSeen';
export const READY_SEEN_STORAGE_KEY = 'ballbattle.readySeen';
/** 'on' or 'off'; missing on a device from before ADR 0040, where the cards follow the old switch. */
export const READY_CARD_STORAGE_KEY = 'ballbattle.readyCard';
/** ADR 0036's count of versus cards seen; cleared by a reset, never read. */
const OLD_VERSUS_STORAGE_KEY = 'ballbattle.versusSeen';

export type TipStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Tips {
  /** Ability hints in the arena ("Lightning!"). */
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** The ready moment's "what to watch" card ("Don't show these again" turns it off). */
  readyCards(): boolean;
  setReadyCards(on: boolean): void;
  /** True the first time this device sees `key` (a ball's ability) while hints are on. */
  takeHint(key: string): boolean;
  /**
   * True the first time this device meets the pairing of `a` and `b` (either order), while the
   * cards are on; marks it seen. The card's reason is per pairing, so it shows exactly when it
   * says something new.
   */
  takeReady(a: string, b: string): boolean;
  /** "Show all tips again": both switches on, and every hint and card unseen. */
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

const listOf = (value: string | null) => (value ?? '').split(',').filter((id) => id !== '');

/** One key for a pairing, whichever slot each ball is in. */
export const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export function createTips(storage: TipStorage): Tips {
  // Kept in memory too, so a tip never repeats within a page load even when storage fails.
  let on = read(storage, TIPS_STORAGE_KEY) !== 'off';
  const storedCards = read(storage, READY_CARD_STORAGE_KEY);
  // A device that turned all tips off before the split keeps its cards off too.
  let cards = storedCards === null ? on : storedCards !== 'off';
  if (storedCards === null && !cards) write(storage, READY_CARD_STORAGE_KEY, 'off');
  const seen = new Set(listOf(read(storage, HINTS_SEEN_STORAGE_KEY)));
  const pairs = new Set(listOf(read(storage, READY_SEEN_STORAGE_KEY)));
  return {
    enabled: () => on,
    setEnabled(next) {
      on = next;
      write(storage, TIPS_STORAGE_KEY, next ? undefined : 'off');
    },
    readyCards: () => cards,
    setReadyCards(next) {
      cards = next;
      write(storage, READY_CARD_STORAGE_KEY, next ? 'on' : 'off');
    },
    takeHint(key) {
      if (!on || seen.has(key)) return false;
      seen.add(key);
      write(storage, HINTS_SEEN_STORAGE_KEY, [...seen].join(','));
      return true;
    },
    takeReady(a, b) {
      const key = pairKey(a, b);
      if (!cards || pairs.has(key)) return false;
      pairs.add(key);
      write(storage, READY_SEEN_STORAGE_KEY, [...pairs].join(','));
      return true;
    },
    reset() {
      seen.clear();
      pairs.clear();
      on = true;
      cards = true;
      for (const key of [
        HINTS_SEEN_STORAGE_KEY,
        READY_SEEN_STORAGE_KEY,
        READY_CARD_STORAGE_KEY,
        TIPS_STORAGE_KEY,
        OLD_VERSUS_STORAGE_KEY,
      ]) {
        write(storage, key, undefined);
      }
    },
  };
}
