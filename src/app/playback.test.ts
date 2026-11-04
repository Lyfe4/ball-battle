import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { TICK_MS } from './fixed-step.ts';
import {
  advanceFrame,
  interpolationAlpha,
  startPlayback,
  type PlayedTick,
  type TickFeel,
} from './playback.ts';
import { scaleFrame, type PlaybackSpeed } from './speed.ts';

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
  it.each<[string, string, number, PlaybackSpeed]>([
    ['brawler', 'storm', 3, 1],
    ['speedster', 'archer', 11, 1],
    ['vampire', 'vampire', 5, 1],
    ['brawler', 'storm', 3, 2],
    ['sniper', 'quake', 8, 2],
    ['thorns', 'venom', 4, 2],
  ])(
    'plays %s vs %s (seed %i) at %ix exactly like a headless run, despite irregular frames, hit-stops and slow-mo',
    (a, b, seed, speed) => {
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
        const outcome = advanceFrame(playback, scaleFrame(nextFrame(), speed), stepWorld, busyFeel);
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

  it('runs twice the ticks at 2x for the same real time', () => {
    const ticksAfter = (speed: PlaybackSpeed): number => {
      let playback = startPlayback(matchWorld('brawler', 'storm', 1), 0);
      let ticks = 0;
      for (let i = 0; i < 30; i++) {
        const outcome = advanceFrame(playback, scaleFrame(1000 / 60, speed), stepWorld, () => ({
          hitStopMs: 0,
        }));
        playback = outcome.playback;
        ticks += outcome.ticks.length;
      }
      return ticks;
    };
    expect(ticksAfter(1)).toBe(30);
    expect(ticksAfter(2)).toBe(60);
  });

  it('keeps the world before the latest tick for interpolation', () => {
    const start = matchWorld('brawler', 'storm', 1);
    let playback = startPlayback(start, 0);
    expect(playback.previous).toBe(playback.world);
    const outcome = advanceFrame(playback, 3 * TICK_MS + 4, stepWorld, () => ({ hitStopMs: 0 }));
    playback = outcome.playback;
    expect(playback.previous).toBe(outcome.ticks.at(-1)?.previous);
    expect(playback.world).toBe(outcome.ticks.at(-1)?.result.world);
    // A frame too short for a tick keeps both, and moves the blend on.
    const before = interpolationAlpha(playback);
    const idle = advanceFrame(playback, 5, stepWorld, () => ({ hitStopMs: 0 })).playback;
    expect(idle.previous).toBe(playback.previous);
    expect(idle.world).toBe(playback.world);
    expect(interpolationAlpha(idle)).toBeGreaterThan(before);
  });

  it('blends by the banked share of a tick, clamped, and draws a finished match as it ended', () => {
    const playback = startPlayback(matchWorld('brawler', 'storm', 1), 0);
    expect(interpolationAlpha({ ...playback, accumulatorMs: TICK_MS / 4 })).toBeCloseTo(0.25, 9);
    expect(interpolationAlpha({ ...playback, accumulatorMs: 3 * TICK_MS })).toBe(1);
    const finished = headless(matchWorld('archer', 'brawler', 2)).worlds.at(-1);
    if (finished === undefined) throw new Error('expected a finished world');
    expect(interpolationAlpha({ ...playback, world: finished, accumulatorMs: 2 })).toBe(1);
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
