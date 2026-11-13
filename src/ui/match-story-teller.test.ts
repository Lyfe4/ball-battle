import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { playToEnd } from '../sim/series-verify.ts';
import { createWorld } from '../sim/world.ts';
import { storyOf, type StoryReplay } from './match-story-data.ts';
import {
  createStoryTeller,
  SLICE_MS,
  TICKS_PER_LOOK,
  type TellerClock,
} from './match-story-teller.ts';

const start = (a: string, b: string, seed: number) =>
  createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);

/**
 * A clock where every look costs 1 ms, and slices wait in a queue until `run` is called: one
 * queued slice per call, like one task between two frames.
 */
function fakeClock(): TellerClock & { looks: number; queued: (() => void)[]; runAll(): number } {
  const clock = {
    looks: 0,
    queued: [] as (() => void)[],
    now: () => clock.looks++,
    later: (run: () => void) => {
      clock.queued.push(run);
    },
    /** Runs queued slices until none are left; returns how many ran. */
    runAll() {
      let slices = 0;
      while (clock.queued.length > 0) {
        clock.queued.shift()?.();
        slices++;
      }
      return slices;
    },
  };
  return clock;
}

describe('telling how it was won between frames', () => {
  it('plays nothing during the call, then the match in slices of a few ticks', () => {
    const clock = fakeClock();
    const opening = start('spider', 'speedster', 3);
    const ticks = playToEnd(opening, BALL_LOOKUP).tick;
    let told: StoryReplay | undefined;
    createStoryTeller(BALL_LOOKUP, clock).tell(opening, (replay) => {
      told = replay;
    });
    expect(told).toBeUndefined();
    expect(clock.looks).toBe(0);

    const slices = clock.runAll();
    // Each slice looks at the clock about once per TICKS_PER_LOOK ticks and stops after SLICE_MS.
    expect(slices).toBeGreaterThanOrEqual(Math.floor(ticks / (TICKS_PER_LOOK * SLICE_MS)));
    expect(told?.done).toBe(true);
    expect(told?.story()).toStrictEqual(storyOf(opening, BALL_LOOKUP));
  });

  it('shares one replay between two copies of the same match, and answers at once when played', () => {
    const clock = fakeClock();
    const teller = createStoryTeller(BALL_LOOKUP, clock);
    const told: StoryReplay[] = [];
    teller.tell(start('hex', 'berserker', 2), (replay) => told.push(replay));
    teller.tell(start('hex', 'berserker', 2), (replay) => told.push(replay));
    clock.runAll();
    expect(told).toHaveLength(2);
    expect(told[0]).toBe(told[1]);

    teller.tell(start('hex', 'berserker', 2), (replay) => told.push(replay));
    expect(told).toHaveLength(3);
    expect(told[2]).toBe(told[0]);
  });
});
