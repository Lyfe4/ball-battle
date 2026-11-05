import { describe, expect, it } from 'vitest';
import { applyActions, sceneOf } from './abilities/apply-actions.ts';
import { defineBall } from './define-ball.ts';
import { indexDefinitions } from './definitions.ts';
import {
  expireStatuses,
  hasStatus,
  SHOCK_HEAL_REDUCTION,
  shockedHeal,
  withStatus,
} from './status.ts';
import { step } from './step.ts';
import { blue, red, withBalls } from './test-support.ts';
import type { AbilityAction, BallState, SimEvent, WorldState } from './types.ts';
import { createWorld } from './world.ts';

const definitions = indexDefinitions([red, blue]);
const world = createWorld(1, [red, blue]);
const shock = { kind: 'shocked', durationTicks: 10 } as const;

function apply(balls: readonly BallState[], actions: readonly AbilityAction[], tick = 5) {
  return applyActions(sceneOf(balls), 'ball-0', actions, definitions, tick, 1000);
}

const target = (balls: readonly BallState[]): BallState => {
  const ball = balls[1];
  if (ball === undefined) throw new Error('expected ball-1');
  return ball;
};

describe('status effects', () => {
  it('applies a status with an absolute expiry and reports it', () => {
    const { balls, events } = apply(world.balls, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]);
    expect(target(balls).statuses).toStrictEqual([
      { kind: 'shocked', sourceId: 'ball-0', expiresTick: 15, sinceTick: 5 },
    ]);
    expect(events).toStrictEqual([
      {
        type: 'statusApplied',
        tick: 5,
        ballId: 'ball-1',
        sourceId: 'ball-0',
        status: 'shocked',
        expiresTick: 15,
        refreshed: false,
      },
    ]);
  });

  it('refreshes rather than stacks: one entry, the later expiry, the latest source, the first tick', () => {
    const once = withStatus(target(world.balls), shock, 'ball-0', 5).ball;
    const longer = withStatus(once, { ...shock, durationTicks: 20 }, 'ball-2', 8);
    expect(longer.ball.statuses).toStrictEqual([
      { kind: 'shocked', sourceId: 'ball-2', expiresTick: 28, sinceTick: 5 },
    ]);
    expect(longer.event.refreshed).toBe(true);
    // A shorter re-application never shortens it.
    const shorter = withStatus(longer.ball, { ...shock, durationTicks: 1 }, 'ball-0', 9).ball;
    expect(shorter.statuses).toStrictEqual([
      { kind: 'shocked', sourceId: 'ball-0', expiresTick: 28, sinceTick: 5 },
    ]);
  });

  it('rejects durations that are not a whole number of at least one tick', () => {
    for (const durationTicks of [0, -3, 1.5, Number.NaN]) {
      expect(() =>
        withStatus(target(world.balls), { ...shock, durationTicks }, 'ball-0', 5),
      ).toThrow(/invalid/);
    }
  });

  it('does nothing to a defeated target', () => {
    const balls = withBalls(world, [{}, { health: 0 }]).balls;
    const result = apply(balls, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]);
    expect(target(result.balls).statuses).toStrictEqual([]);
    expect(result.events).toStrictEqual([]);
  });

  it('expires at the start of its expiry tick, active on every tick before', () => {
    const shocked = withStatus(target(world.balls), shock, 'ball-0', 5).ball;
    expect(expireStatuses([shocked], 14).balls[0]).toBe(shocked);
    const expired = expireStatuses([shocked], 15);
    expect(expired.balls[0]?.statuses).toStrictEqual([]);
    expect(expired.events).toStrictEqual([
      { type: 'statusExpired', tick: 15, ballId: 'ball-1', status: 'shocked' },
    ]);
  });
});

describe('shocked', () => {
  const hurt = withBalls(world, [{}, { health: 40 }]).balls;

  it('reduces heals by SHOCK_HEAL_REDUCTION, reporting what was lost before healed', () => {
    const shocked = apply(hurt, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]).balls;
    const { balls, events } = apply(shocked, [{ kind: 'heal', targetId: 'ball-1', amount: 12 }]);
    const restored = shockedHeal(12);
    expect(restored).toBe(Math.round(12 * (1 - SHOCK_HEAL_REDUCTION)));
    expect(restored).toBeLessThan(12);
    expect(target(balls).health).toBe(40 + restored);
    expect(events).toStrictEqual([
      {
        type: 'healReduced',
        tick: 5,
        ballId: 'ball-1',
        sourceId: 'ball-0',
        lost: 12 - restored,
        status: 'shocked',
      },
      // The heal cut is an interaction rule: the arena shows its cue (ADR 0028).
      { type: 'ruleApplied', tick: 5, ballId: 'ball-1', rule: 'healCut' },
      {
        type: 'healed',
        tick: 5,
        ballId: 'ball-1',
        sourceId: 'ball-0',
        amount: restored,
        healthAfter: 40 + restored,
      },
    ]);
  });

  it('counts only what the max-health cap would have allowed as lost', () => {
    // 3 below max: a full heal would restore 3; shocked, it restores min(3, reduced 12).
    const nearlyFull = withBalls(world, [{}, { health: blue.maxHealth - 3 }]).balls;
    const shocked = apply(nearlyFull, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]).balls;
    const { events } = apply(shocked, [{ kind: 'heal', targetId: 'ball-1', amount: 12 }]);
    expect(events.map((event) => event.type)).toStrictEqual(['healed']);
    expect(events[0]).toMatchObject({ amount: 3, healthAfter: blue.maxHealth });
  });

  it('reports nothing for a heal that would restore nothing anyway', () => {
    const full = apply(world.balls, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]).balls;
    expect(apply(full, [{ kind: 'heal', targetId: 'ball-1', amount: 12 }]).events).toStrictEqual(
      [],
    );
  });

  it('heals normally again once the status has expired', () => {
    const shocked = apply(hurt, [
      { kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 10 },
    ]).balls;
    const after = expireStatuses(shocked, 15).balls;
    expect(hasStatus(target(after), 'shocked')).toBe(false);
    expect(
      target(apply(after, [{ kind: 'heal', targetId: 'ball-1', amount: 12 }]).balls).health,
    ).toBe(52);
  });
});

describe('statuses through step', () => {
  /** Shocks ball-1 for 30 ticks on tick 3, through an onTick action. */
  const shocker = defineBall({
    ...red,
    id: 'shocker',
    hooks: {
      onTick: ({ world: current }) =>
        current.tick === 3
          ? [{ kind: 'applyStatus', targetId: 'ball-1', status: 'shocked', durationTicks: 30 }]
          : [],
    },
  });
  const lookup = indexDefinitions([shocker, blue]);

  function play(start: WorldState, ticks: number) {
    let current = start;
    const events: SimEvent[] = [];
    const shockedOn: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const result = step(current, lookup);
      current = result.world;
      events.push(...result.events);
      if (current.balls[1]?.statuses.length === 1) shockedOn.push(current.tick);
    }
    return { world: current, events, shockedOn };
  }

  it('is shocked from the action on tick 3 through tick 32, gone at the start of tick 33', () => {
    // Far apart and still, so nothing else happens.
    const start = withBalls(createWorld(2, [shocker, blue]), [
      { position: { x: 150, y: 150 }, velocity: { x: 0, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const { shockedOn, events } = play(start, 40);
    expect(shockedOn[0]).toBe(3);
    expect(shockedOn.at(-1)).toBe(32);
    expect(shockedOn).toHaveLength(30);
    const expired = events.filter((event) => event.type === 'statusExpired');
    expect(expired).toStrictEqual([
      { type: 'statusExpired', tick: 33, ballId: 'ball-1', status: 'shocked' },
    ]);
    // The expiry is the first event of its tick.
    expect(events.find((event) => event.tick === 33)).toStrictEqual(expired[0]);
  });

  it('never gives a ball a status without an action', () => {
    let current = createWorld(4, [red, blue]);
    for (let i = 0; i < 600 && current.match.status === 'running'; i++) {
      const result = step(current, definitions);
      current = result.world;
      expect(result.events.some((event) => event.type === 'statusApplied')).toBe(false);
      for (const ball of current.balls) expect(ball.statuses).toStrictEqual([]);
    }
  });
});
