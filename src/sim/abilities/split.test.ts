// The split action and sides (ADR 0059): a ball split in two fights on as one side.
import { describe, expect, it } from 'vitest';
import { nearestEnemy } from '../balls/targeting.ts';
import { MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { evaluateMatch } from '../match.ts';
import { sideOf } from '../side.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { AbilityAction, BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { applyActions, sceneOf } from './apply-actions.ts';

type JellyState = Readonly<{ split: boolean }>;

/** A test-only ball that splits once, the first time a hit takes it to half health or less. */
const jelly = defineBall<JellyState>({
  id: 'jelly',
  name: 'Jelly',
  description: 'Test fixture: splits at half health.',
  color: '#ffffff',
  radius: 50,
  speed: 700,
  maxHealth: 40,
  contactDamage: 5,
  initialAbilityState: { split: false },
  hooks: {
    onDamageTaken: ({ self, stats }) => {
      if (self.abilityState.split || self.health > stats.maxHealth / 2) return [];
      const keep = Math.ceil(self.health / 2);
      return [
        { kind: 'setAbilityState', state: { split: true } },
        {
          kind: 'split',
          keepHealth: keep,
          splitHealth: self.health - keep,
          state: { split: true },
          spread: 80,
        },
      ];
    },
  },
});

const lookup = indexDefinitions([jelly, red]);

function play(world: WorldState, ticks: number): { world: WorldState; events: SimEvent[] } {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** The jelly on `health`, about to meet red head-on (red's bump is 15). */
function headOn(health: number): WorldState {
  return withBalls(createWorld(1, [jelly, red]), [
    { position: { x: 440, y: 500 }, velocity: { x: 700, y: 0 }, health },
    { position: { x: 560, y: 500 }, velocity: { x: -800, y: 0 } },
  ]);
}

describe('the split action', () => {
  it('a hit to half health splits the ball in two on its side, sharing what it has left', () => {
    const { world, events } = play(headOn(30), 20);
    const split = events.find((event) => event.type === 'split');
    expect(split).toMatchObject({ ballId: 'ball-0', newBallId: 'ball-0~1' });
    expect(world.balls.map((ball) => ball.id)).toStrictEqual(['ball-0', 'ball-1', 'ball-0~1']);
    const [first, , second] = world.balls;
    expect(sideOf(first ?? red)).toBe('ball-0');
    expect(second?.side).toBe('ball-0');
    // 30 - 15 = 15 left: 8 kept, 7 to the new half.
    expect([first?.health, second?.health]).toStrictEqual([8, 7]);
  });

  it('splits once per ball, even when two splits come in one tick', () => {
    const [self] = headOn(30).balls;
    if (self === undefined) throw new Error('No ball');
    const request: AbilityAction = {
      kind: 'split',
      keepHealth: 10,
      splitHealth: 10,
      state: { split: true },
      spread: 80,
    };
    const result = applyActions(
      sceneOf(headOn(30).balls),
      'ball-0',
      [request, request],
      lookup,
      5,
      1000,
    );
    expect(result.balls).toHaveLength(3);
    expect(result.events.filter((event) => event.type === 'split')).toHaveLength(1);
    // A half never splits again either.
    const again = applyActions(sceneOf(result.balls), 'ball-0~1', [request], lookup, 6, 1000);
    expect(again.balls).toHaveLength(3);
  });

  it('allies never touch, and an enemy never aims at its own side', () => {
    const base = headOn(30).balls;
    const [a, b] = base;
    if (a === undefined || b === undefined) throw new Error('No balls');
    const ally: BallState = { ...a, id: 'ball-0~1', side: 'ball-0' };
    const world: WorldState = {
      ...headOn(30),
      balls: [
        { ...a, side: 'ball-0', position: { x: 300, y: 500 }, velocity: { x: 700, y: 0 } },
        { ...b, position: { x: 800, y: 200 }, velocity: { x: 0, y: 800 } },
        { ...ally, position: { x: 400, y: 500 }, velocity: { x: -700, y: 0 } },
      ],
    };
    const { events } = play(world, 10);
    expect(events.filter((event) => event.type === 'collision')).toHaveLength(0);
    expect(nearestEnemy(world.balls[0] ?? a, world.balls)?.id).toBe('ball-1');
  });

  it('the side is out only when both halves are, and wins on their health together', () => {
    const [a, b] = headOn(30).balls;
    if (a === undefined || b === undefined) throw new Error('No balls');
    const half = (health: number): BallState => ({ ...a, id: 'ball-0~1', side: 'ball-0', health });
    const one = [{ ...a, side: 'ball-0', health: 0 }, b, half(5)];
    expect(evaluateMatch(one, 100, lookup).status).toBe('running');
    const none = [{ ...a, side: 'ball-0', health: 0 }, b, half(0)];
    expect(evaluateMatch(none, 100, lookup)).toMatchObject({
      status: 'finished',
      result: { kind: 'win', winnerId: 'ball-1' },
    });
    // At the time limit: 12 + 12 of 40 (0.6) beats red's 40 of 75 (0.53).
    const late = [{ ...a, side: 'ball-0', health: 12 }, { ...b, health: 40 }, half(12)];
    expect(evaluateMatch(late, MATCH_TIME_LIMIT_TICKS, lookup)).toMatchObject({
      result: { kind: 'win', winnerId: 'ball-0' },
    });
  });
});
