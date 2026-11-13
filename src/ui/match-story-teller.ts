// Tells "How it was won" without any frame paying for it. Replaying a whole match at once cost
// 18-22 ms of a phone frame (4x CPU throttle) on the frame the result appeared, so the replay runs
// in short slices between frames instead, started as soon as the fight ends: the knockout's
// slow-mo and the Winner sticker leave over a second before the result line is needed. One teller
// per definition lookup keeps the last few replays, so the HUD and the series panel share one
// replay of the same match.
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { startReplay, type StoryReplay } from './match-story-data.ts';

/** Real time one slice of replay may take before it yields to the next frame. */
export const SLICE_MS = 3;
/** Ticks played between looks at the clock: well under a millisecond on a slow phone. */
export const TICKS_PER_LOOK = 20;
/** Replays kept: the match on screen and the few before it. */
export const KEPT_REPLAYS = 4;

export interface StoryTeller {
  /**
   * Calls `ready` with the replay of the match from `start` once it has been played: in slices
   * between frames, never during this call, unless it was already played.
   */
  tell(start: WorldState, ready: (replay: StoryReplay) => void): void;
}

/** When a slice is and when the next one runs: the browser's by default, a fake one in tests. */
export interface TellerClock {
  now(): number;
  later(run: () => void): void;
}

const browserClock: TellerClock = {
  now: () => performance.now(),
  later: (run) => {
    setTimeout(run, 0);
  },
};

interface Entry {
  readonly replay: StoryReplay;
  readonly waiting: ((replay: StoryReplay) => void)[];
}

export function createStoryTeller(
  lookup: DefinitionLookup,
  clock: TellerClock = browserClock,
): StoryTeller {
  const kept = new Map<string, Entry>();

  function slice(entry: Entry): void {
    const until = clock.now() + SLICE_MS;
    while (!entry.replay.advance(TICKS_PER_LOOK)) {
      if (clock.now() >= until) {
        clock.later(() => {
          slice(entry);
        });
        return;
      }
    }
    for (const ready of entry.waiting.splice(0)) ready(entry.replay);
  }

  return {
    tell(start, ready) {
      // The opening world is small (seed, balls, their starting state), and two screens build
      // their own copies of the same match, so it is keyed by what it holds, not by identity.
      const key = JSON.stringify(start);
      const known = kept.get(key);
      if (known?.replay.done === true) {
        ready(known.replay);
        return;
      }
      if (known !== undefined) {
        known.waiting.push(ready);
        return;
      }
      const entry: Entry = { replay: startReplay(start, lookup), waiting: [ready] };
      kept.set(key, entry);
      const oldest = kept.keys().next().value;
      if (kept.size > KEPT_REPLAYS && oldest !== undefined) kept.delete(oldest);
      clock.later(() => {
        slice(entry);
      });
    },
  };
}

const tellers = new WeakMap<DefinitionLookup, StoryTeller>();

/** The one teller for `lookup`, shared by every screen that tells a story. */
export function storyTellerFor(lookup: DefinitionLookup): StoryTeller {
  let teller = tellers.get(lookup);
  if (teller === undefined) {
    teller = createStoryTeller(lookup);
    tellers.set(lookup, teller);
  }
  return teller;
}
