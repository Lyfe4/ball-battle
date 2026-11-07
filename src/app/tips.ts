// What a newcomer has already been shown (ADR 0036, 0037), remembered on their device: the balls
// whose ability hint has shown, the pairings whose "what to watch" card has shown, and whether tips
// (and the card) are on at all. Storage can be missing or throw (private windows, blocked site
// data); then tips still work for this page load and are simply shown again next time.

export const TIPS_STORAGE_KEY = 'ballbattle.tips';
export const HINTS_SEEN_STORAGE_KEY = 'ballbattle.hintsSeen';
export const READY_SEEN_STORAGE_KEY = 'ballbattle.readySeen';
export const READY_CARD_STORAGE_KEY = 'ballbattle.readyCard';
/** ADR 0036's count of versus cards seen; cleared by a reset, never read. */
const OLD_VERSUS_STORAGE_KEY = 'ballbattle.versusSeen';

export type TipStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Tips {
  /** Off means no hints and no "what to watch" card. */
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** True the first time this device sees `ballId`'s ability; marks it seen. */
  takeHint(ballId: string): boolean;
  /**
   * True the first time this device meets the pairing of `a` and `b` (either order), while tips and
   * the card are on; marks it seen. The card's reason is per pairing, so it shows exactly when it
   * says something new.
   */
  takeReady(a: string, b: string): boolean;
  /** Turns the "what to watch" card off ("Don't show these again"), leaving the hints on. */
  hideReadyCards(): void;
  /** Shows every hint and card again, and turns tips on. */
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
  let cards = read(storage, READY_CARD_STORAGE_KEY) !== 'off';
  const seen = new Set(listOf(read(storage, HINTS_SEEN_STORAGE_KEY)));
  const pairs = new Set(listOf(read(storage, READY_SEEN_STORAGE_KEY)));
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
    takeReady(a, b) {
      const key = pairKey(a, b);
      if (!on || !cards || pairs.has(key)) return false;
      pairs.add(key);
      write(storage, READY_SEEN_STORAGE_KEY, [...pairs].join(','));
      return true;
    },
    hideReadyCards() {
      cards = false;
      write(storage, READY_CARD_STORAGE_KEY, 'off');
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
