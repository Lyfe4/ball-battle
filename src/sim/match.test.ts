import { describe, expect, it } from 'vitest';
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import { MATCH_TIME_LIMIT_TICKS } from './constants.ts';
import { step } from './step.ts';
import { run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { WorldState } from './types.ts';
import { createWorld } from './world.ts';

const base = createWorld(1, testDefinitions);

function headOn(redHealth: number, blueHealth: number): WorldState {
  return withBalls(base, [
    { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 }, health: redHealth },
    { position: { x: 600, y: 500 }, velocity: { x: -blue.speed, y: 0 }, health: blueHealth },
  ]);
}

/** Balls far apart and still, one tick before the time limit. */
function atTimeLimit(redHealth: number, blueHealth: number): WorldState {
  return {
    ...withBalls(base, [
      { position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 }, health: redHealth },
      { position: { x: 900, y: 900 }, velocity: { x: 0, y: 0 }, health: blueHealth },
    ]),
    tick: MATCH_TIME_LIMIT_TICKS - 1,
  };
}

describe('match end', () => {
  it('starts running', () => {
    expect(base.match).toStrictEqual({ status: 'running' });
  });

  it('ends with the survivor winning when a ball reaches 0 health', () => {
    const { world, events } = run(headOn(blue.contactDamage, blue.maxHealth), 60);
    expect(world.match).toMatchObject({
      status: 'finished',
      result: { kind: 'win', winnerId: 'ball-1' },
      reason: 'knockout',
    });
    expect(events.map((event) => event.type)).toStrictEqual([
      'collision',
      'damage',
      'damage',
      'ballDefeated',
      'matchEnded',
    ]);
    expect(events.at(-1)).toMatchObject({ result: { kind: 'win', winnerId: 'ball-1' } });
  });

  it('is a draw when both balls are defeated by the same collision', () => {
    const { world, events } = run(headOn(blue.contactDamage, red.contactDamage), 60);
    expect(world.match).toMatchObject({ result: { kind: 'draw' }, reason: 'knockout' });
    expect(events.filter((event) => event.type === 'ballDefeated')).toHaveLength(2);
  });

  it('gives the win to the higher health fraction at the time limit', () => {
    const { world, events } = step(
      atTimeLimit(red.maxHealth * 0.5, blue.maxHealth * 0.75),
      testLookup,
    );
    expect(world.tick).toBe(MATCH_TIME_LIMIT_TICKS);
    expect(world.match).toStrictEqual({
      status: 'finished',
      result: { kind: 'win', winnerId: 'ball-1' },
      reason: 'timeLimit',
      endTick: MATCH_TIME_LIMIT_TICKS,
    });
    expect(events).toStrictEqual([
      {
        type: 'matchEnded',
        tick: MATCH_TIME_LIMIT_TICKS,
        result: { kind: 'win', winnerId: 'ball-1' },
        reason: 'timeLimit',
      },
    ]);
  });

  it('judges on health fraction, not raw health', () => {
    // Red at 90% beats blue at 80%, whichever has more raw health.
    const { world } = step(atTimeLimit(red.maxHealth * 0.9, blue.maxHealth * 0.8), testLookup);
    expect(world.match).toMatchObject({ result: { kind: 'win', winnerId: 'ball-0' } });
  });

  it('is a draw at the time limit when health fractions are equal', () => {
    const { world } = step(atTimeLimit(red.maxHealth / 3, blue.maxHealth / 3), testLookup);
    expect(world.match).toMatchObject({ result: { kind: 'draw' }, reason: 'timeLimit' });
  });

  it('does nothing once finished: same world, no events', () => {
    const finished = run(headOn(1, blue.maxHealth), 60).world;
    expect(finished.match.status).toBe('finished');
    const result = step(finished, testLookup);
    expect(result.world).toBe(finished);
    expect(result.events).toStrictEqual([]);
  });

  it('ends every match within the time limit', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { world, events } = run(createWorld(seed, testDefinitions), MATCH_TIME_LIMIT_TICKS);
      expect(world.match.status).toBe('finished');
      expect(world.tick).toBeLessThanOrEqual(MATCH_TIME_LIMIT_TICKS);
      const ended = events.filter((event) => event.type === 'matchEnded');
      expect(ended).toHaveLength(1);
      expect(events.at(-1)).toBe(ended[0]);
    }
  });
});
