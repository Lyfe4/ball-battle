import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { advanceFrame, startPlayback, type PlayedTick, type TickFeel } from './playback.ts';

const stepWorld = (world: WorldState) => step(world, BALL_LOOKUP);

function matchWorld(a: string, b: string, seed: number): WorldState {
  return createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
}

/** The whole match played headlessly, one tick after another. */
function headless(world: WorldState): { worlds: WorldState[]; events: SimEvent[] } {
  const worlds: WorldState[] = [];
  const events: SimEvent[] = [];
  let current = world;
  while (current.match.status === 'running') {
    const result = stepWorld(current);
    current = result.world;
    worlds.push(current);
    events.push(...result.events);
  }
  return { worlds, events };
}

/** Frame lengths that never repeat a pattern: 1 to 70 ms, with the odd long stall. */
function irregularFrames(): () => number {
  let state = 7;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const roll = state % 100;
    return roll < 3 ? 400 : 1 + (roll % 70) + (state % 7) / 7;
  };
}

/** Hit-stops on every damage tick, and slow-mo every 200 ticks: far busier than the game. */
function busyFeel(tick: PlayedTick): TickFeel {
  const { world, events } = tick.result;
  const hit = events.some((event) => event.type === 'damage');
  return {
    hitStopMs: hit ? 70 : 0,
    ...(world.tick % 200 === 0 ? { slowMo: { ms: 300, scale: 0.3 } } : {}),
  };
}

describe('playback', () => {
  it.each([
    ['brawler', 'storm', 3],
    ['speedster', 'archer', 11],
    ['vampire', 'vampire', 5],
  ])(
    'plays %s vs %s exactly like a headless run, despite irregular frames, hit-stops and slow-mo',
    (a, b, seed) => {
      const start = matchWorld(a, b, seed);
      const expected = headless(start);
      const nextFrame = irregularFrames();

      let playback = startPlayback(start, 900);
      const worlds: WorldState[] = [];
      const events: SimEvent[] = [];
      let frames = 0;
      let frozenFrames = 0;
      let slowFrames = 0;
      while (playback.world.match.status === 'running') {
        if (playback.clock.hitStopMs > 0) frozenFrames++;
        if (playback.clock.slowMoMs > 0) slowFrames++;
        const outcome = advanceFrame(playback, nextFrame(), stepWorld, busyFeel);
        playback = outcome.playback;
        for (const { result } of outcome.ticks) {
          worlds.push(result.world);
          events.push(...result.events);
        }
        frames++;
        expect(frames).toBeLessThan(100_000);
      }

      expect(worlds).toStrictEqual(expected.worlds);
      expect(events).toStrictEqual(expected.events);
      // The presentation really did freeze and slow down along the way.
      expect(frozenFrames).toBeGreaterThan(2);
      expect(slowFrames).toBeGreaterThan(0);
    },
  );

  it('waits for the intro before the first tick', () => {
    let playback = startPlayback(matchWorld('brawler', 'storm', 1), 500);
    for (let i = 0; i < 29; i++) {
      const outcome = advanceFrame(playback, 1000 / 60, stepWorld, () => ({ hitStopMs: 0 }));
      expect(outcome.ticks).toHaveLength(0);
      playback = outcome.playback;
    }
    // Effect time kept running during the intro.
    expect(playback.effectMs).toBeCloseTo((29 * 1000) / 60, 9);
    const outcome = advanceFrame(playback, 1000 / 60 + 20, stepWorld, () => ({ hitStopMs: 0 }));
    expect(outcome.ticks.length).toBeGreaterThan(0);
  });

  it('ends a frame at a hit-stop and banks the skipped ticks', () => {
    const playback = startPlayback(matchWorld('brawler', 'storm', 1), 0);
    // Five ticks' worth of time; the first tick asks for a hit-stop.
    const outcome = advanceFrame(playback, (5 * 1000) / 60, stepWorld, () => ({ hitStopMs: 40 }));
    expect(outcome.ticks).toHaveLength(1);
    expect(outcome.playback.accumulatorMs).toBeCloseTo((4 * 1000) / 60, 6);
    expect(outcome.playback.clock.hitStopMs).toBe(40);
  });

  it('plays nothing once the match is over', () => {
    const start = matchWorld('archer', 'brawler', 2);
    const finished = headless(start).worlds.at(-1);
    if (finished === undefined) throw new Error('expected a finished world');
    const outcome = advanceFrame(startPlayback(finished, 0), 100, stepWorld, () => ({
      hitStopMs: 0,
    }));
    expect(outcome.ticks).toHaveLength(0);
    expect(outcome.playback.world).toBe(finished);
  });
});
