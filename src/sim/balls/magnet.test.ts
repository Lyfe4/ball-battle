// The Magnet's hit-started pull (ADR 0058): a hit from range starts a harder pull at once. The timed
// pull is in batch-3.test.ts.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { DamageVia, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  FIRST_PULL_TICK,
  HIT_PULL_REST_TICKS,
  HIT_PULL_SHARE,
  HIT_PULL_TICKS,
  magnet,
  type MagnetState,
  PULL_SHARE,
  PULL_TICKS,
  startsPull,
} from './magnet.ts';

const lookup = indexDefinitions([magnet, blue]);

/** The Magnet along the top, blue far below it heading right: they never meet, nor hit a wall. */
const scene = (state?: Partial<MagnetState>): WorldState => {
  const world = createWorld(1, [magnet, blue]);
  const own = world.balls[0]?.abilityState ?? {};
  return withBalls(world, [
    { position: { x: 500, y: 100 }, velocity: { x: 1, y: 0 }, abilityState: { ...own, ...state } },
    { position: { x: 100, y: 850 }, velocity: { x: blue.speed, y: 0 }, health: 10_000 },
  ]);
};

/** The Magnet's state after a hit dealt by `via` on `tick`, from `state`. */
function afterHit(via: DamageVia | 'contact', tick: number, state?: Partial<MagnetState>) {
  const world = { ...scene(state), tick };
  const self = world.balls[0];
  const hook = magnet.hooks.onDamageTaken;
  if (self === undefined || hook === undefined) throw new Error('no Magnet');
  const actions = hook({ world, self, via, amount: 10, reduced: 0 } as unknown as Parameters<
    typeof hook
  >[0]);
  const set = actions.find((action) => action.kind === 'setAbilityState');
  return set?.kind === 'setAbilityState' ? (set.state as MagnetState) : undefined;
}

/** How far blue has turned up toward the Magnet after `ticks`, before any timed pull. */
function turnAfter(ticks: number, state: Partial<MagnetState>): number {
  let world = scene(state);
  for (let i = 0; i < ticks; i++) world = step(world, lookup).world;
  return -(world.balls[1]?.velocity.y ?? 0);
}

describe('Magnet: a hit from range starts a pull', () => {
  it('reacts to projectiles and minions only, never a bump, strike, blast or poison', () => {
    expect(startsPull('projectile')).toBe(true);
    expect(startsPull('minion')).toBe(true);
    for (const via of ['contact', 'zone', 'zonePulse', 'poison', 'onTick', 'onHitBall'] as const) {
      expect({ via, starts: startsPull(via) }).toStrictEqual({ via, starts: false });
      expect(afterHit(via, 10)).toBeUndefined();
    }
  });

  it('pulls harder at once for HIT_PULL_TICKS, then rests HIT_PULL_REST_TICKS', () => {
    expect(afterHit('projectile', 10)).toMatchObject({
      pullUntilTick: 10 + HIT_PULL_TICKS,
      pullShare: HIT_PULL_SHARE,
      hitReadyTick: 10 + HIT_PULL_TICKS + HIT_PULL_REST_TICKS,
    });
    expect(HIT_PULL_SHARE).toBeGreaterThan(PULL_SHARE);
  });

  it('starts nothing while a pull is in progress or resting, and starts again after', () => {
    const started = afterHit('minion', 10);
    if (started === undefined) throw new Error('no pull started');
    expect(afterHit('projectile', 10 + HIT_PULL_TICKS - 1, started)).toBeUndefined();
    expect(afterHit('projectile', 10 + HIT_PULL_TICKS, started)).toBeUndefined();
    expect(afterHit('projectile', started.hitReadyTick, started)).toBeDefined();
    // A timed pull in progress is not cut short or replaced either.
    expect(afterHit('projectile', 10, { pullUntilTick: 10 + PULL_TICKS })).toBeUndefined();
  });

  it('turns the enemy faster than a timed pull, keeping its speed', () => {
    expect(FIRST_PULL_TICK).toBeGreaterThan(10);
    const hit = turnAfter(10, { pullUntilTick: HIT_PULL_TICKS, pullShare: HIT_PULL_SHARE });
    const timed = turnAfter(10, { pullUntilTick: HIT_PULL_TICKS, pullShare: PULL_SHARE });
    expect(timed).toBeGreaterThan(0);
    expect(hit).toBeGreaterThan(timed * 2);
  });

  it('keeps the harder pull when a timed pull starts during it, until both end', () => {
    const tick = FIRST_PULL_TICK;
    let world = { ...scene({ pullUntilTick: tick + 50, pullShare: HIT_PULL_SHARE }), tick };
    world = step(world, lookup).world;
    const state = world.balls[0]?.abilityState;
    expect(state).toMatchObject({ pullUntilTick: tick + 50, pullShare: HIT_PULL_SHARE });
  });
});
