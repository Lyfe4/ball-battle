// Keeps a busy fight from turning into noise: pure, on real time (never the match's), so 2x speed,
// a catch-up and a burst of arrows all meet the same limits. Each kind has a shortest gap between
// plays; a kind that repeats inside its run window gets quieter with each repeat, and the whole
// mix plays at most MAX_PER_WINDOW sounds per window, the strongest first.

/** How a kind of sound may repeat. */
export interface GateRule {
  /** Shortest real time between two plays of this kind; closer ones are dropped. */
  readonly gapMs: number;
  /** A play this soon after the last of its kind continues a run, each one quieter. */
  readonly runMs: number;
}

/** Each repeat in a run plays at this share of the one before. */
export const RUN_FALLOFF = 0.75;
/** No repeat in a run plays quieter than this share. */
export const RUN_FLOOR = 0.4;
/** The window the whole mix is counted over, and how many sounds it may hold. */
export const MIX_WINDOW_MS = 120;
export const MAX_PER_WINDOW = 4;

export interface Gate<K extends string> {
  /**
   * Which of `wanted` play at `nowMs` (real time), each with its gain share (0-1). Wanted sounds
   * arrive in event order; the strongest win when the mix is full.
   */
  pass(
    wanted: readonly { readonly kind: K; readonly strength: number }[],
    nowMs: number,
  ): readonly number[];
  reset(): void;
}

/**
 * A gate for these rules. `pass` returns, for each wanted sound in order, its gain share, or 0 when
 * it is dropped.
 */
export function createGate<K extends string>(rules: Readonly<Record<K, GateRule>>): Gate<K> {
  const last = new Map<K, number>();
  const runs = new Map<K, number>();
  let played: number[] = [];

  return {
    pass(wanted, nowMs) {
      played = played.filter((at) => nowMs - at < MIX_WINDOW_MS);
      const order = wanted
        .map((sound, index) => ({ sound, index }))
        .sort((x, y) => y.sound.strength - x.sound.strength);
      const gains = wanted.map(() => 0);
      for (const { sound, index } of order) {
        const rule = rules[sound.kind];
        const previous = last.get(sound.kind);
        if (previous !== undefined && nowMs - previous < rule.gapMs) continue;
        if (played.length >= MAX_PER_WINDOW) continue;
        const inRun = previous !== undefined && nowMs - previous < rule.runMs;
        const count = inRun ? (runs.get(sound.kind) ?? 0) + 1 : 0;
        runs.set(sound.kind, count);
        last.set(sound.kind, nowMs);
        played.push(nowMs);
        gains[index] = Math.max(RUN_FLOOR, RUN_FALLOFF ** count);
      }
      return gains;
    },
    reset() {
      last.clear();
      runs.clear();
      played = [];
    },
  };
}
