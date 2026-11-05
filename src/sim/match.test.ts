import { describe, expect, it } from 'vitest';
import { MATCH_TIME_LIMIT_TICKS } from './constants.ts';
import { step } from './step.ts';
import { blue, red, run, testDefinitions, testLookup, withBalls } from './test-support.ts';
import type { DamageEvent, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

/**
 * Seeds for the tests that play whole matches with the fixture balls. 30 keeps the unit suite fast
 * (200 took about 4 s each and needed a raised timeout); the roster-wide versions of these
 * properties play every real matchup in the slow suite.
 */
const MATCH_SEEDS = 30;

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
    for (let seed = 0; seed < MATCH_SEEDS; seed++) {
      const { world, events } = run(createWorld(seed, testDefinitions), MATCH_TIME_LIMIT_TICKS);
      expect(world.match.status).toBe('finished');
      expect(world.tick).toBeLessThanOrEqual(MATCH_TIME_LIMIT_TICKS);
      const ended = events.filter((event) => event.type === 'matchEnded');
      expect(ended).toHaveLength(1);
      expect(events.at(-1)).toBe(ended[0]);
    }
  });

  describe('lethal-exchange tiebreak', () => {
    function damageTo(events: readonly SimEvent[], targetId: string): DamageEvent | undefined {
      return events.find(
        (event): event is DamageEvent => event.type === 'damage' && event.targetId === targetId,
      );
    }

    it('lets the bigger hitter survive on 1 health and win', () => {
      // Head-on at full speed: red deals 15, blue deals 17. Both hits are lethal.
      const { world, events } = run(headOn(blue.contactDamage, red.contactDamage), 60);
      expect(world.match).toMatchObject({
        result: { kind: 'win', winnerId: 'ball-1' },
        reason: 'knockout',
      });
      expect(world.balls.map((ball) => ball.health)).toStrictEqual([0, 1]);
      expect(damageTo(events, 'ball-1')).toMatchObject({
        sourceId: 'ball-0',
        amount: red.contactDamage - 1,
        healthAfter: 1,
        survivedLethal: true,
      });
      expect(damageTo(events, 'ball-0')).toMatchObject({
        amount: blue.contactDamage,
        healthAfter: 0,
        survivedLethal: false,
      });
      expect(events.filter((event) => event.type === 'ballDefeated')).toStrictEqual([
        expect.objectContaining({ ballId: 'ball-0', defeatedById: 'ball-1' }),
      ]);
    });

    it('compares raw damage, so the side that hit more directly this time survives', () => {
      // Blue stands still, so its hit drops to the minimum, round(17 * 0.25) = 4; red's head-on
      // hit stays 15. Both are lethal.
      const world = withBalls(headOn(4, red.contactDamage), [{}, { velocity: { x: 0, y: 0 } }]);
      const result = run(world, 60);
      expect(result.world.match).toMatchObject({ result: { kind: 'win', winnerId: 'ball-0' } });
      expect(damageTo(result.events, 'ball-0')).toMatchObject({
        healthAfter: 1,
        survivedLethal: true,
      });
    });

    it('stays a draw when both lethal hits deal exactly equal raw damage', () => {
      const mirror = withBalls(createWorld(1, [red, red]), [
        { position: { x: 400, y: 500 }, velocity: { x: red.speed, y: 0 }, health: 15 },
        { position: { x: 600, y: 500 }, velocity: { x: -red.speed, y: 0 }, health: 15 },
      ]);
      const { world, events } = run(mirror, 60);
      expect(world.match).toMatchObject({ result: { kind: 'draw' }, reason: 'knockout' });
      expect(events.filter((event) => event.type === 'ballDefeated')).toHaveLength(2);
      expect(events.some((event) => event.type === 'damage' && event.survivedLethal)).toBe(false);
    });

    it('reports a survival even when the survivor was already on 1 health', () => {
      const { world, events } = run(headOn(blue.contactDamage, 1), 60);
      expect(world.match).toMatchObject({ result: { kind: 'win', winnerId: 'ball-1' } });
      expect(damageTo(events, 'ball-1')).toMatchObject({
        amount: 0,
        healthAfter: 1,
        survivedLethal: true,
      });
    });

    it('leaves a lethal hit on only one side unchanged', () => {
      // Red would die, blue would not: no tiebreak, blue takes its normal hit.
      const { world, events } = run(headOn(blue.contactDamage, blue.maxHealth), 60);
      expect(world.balls[1]?.health).toBe(blue.maxHealth - red.contactDamage);
      expect(damageTo(events, 'ball-1')?.survivedLethal).toBe(false);
    });
  });
});
