import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { deriveSeed } from '../rng.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { BallDefinition, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';

type DiceState = Readonly<{ rolls: readonly number[] }>;

/** A test-only ball that rolls `count` numbers every tick and keeps them. */
function dice(count: number): BallDefinition {
  return defineBall<DiceState>({
    ...red,
    id: `dice-${count}`,
    initialAbilityState: { rolls: [] },
    hooks: {
      onTick: ({ self, random }) => {
        const rolls = Array.from({ length: count }, () => Math.floor(random() * 1_000_000));
        return [
          { kind: 'setAbilityState', state: { rolls: [...self.abilityState.rolls, ...rolls] } },
        ];
      },
    },
  });
}

function rollsOf(world: WorldState, index: number): readonly number[] {
  const rolls = world.balls[index]?.abilityState['rolls'];
  return Array.isArray(rolls) ? rolls.map(Number) : [];
}

function play(seed: number, definitions: readonly BallDefinition[], ticks: number): WorldState {
  const lookup = indexDefinitions(definitions);
  // Parked far apart so nothing but the hooks happens.
  let world = withBalls(createWorld(seed, definitions), [
    { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
    { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
  ]);
  for (let i = 0; i < ticks; i++) world = step(world, lookup).world;
  return world;
}

describe('hook randomness', () => {
  it('draws the same numbers for the same seed', () => {
    const a = play(7, [dice(2), blue], 20);
    const b = play(7, [dice(2), blue], 20);
    expect(rollsOf(a, 0)).toHaveLength(40);
    expect(rollsOf(a, 0)).toStrictEqual(rollsOf(b, 0));
  });

  it('draws different numbers on different ticks and seeds', () => {
    const rolls = rollsOf(play(7, [dice(1), blue], 50), 0);
    expect(new Set(rolls).size).toBeGreaterThan(45);
    expect(rollsOf(play(8, [dice(1), blue], 5), 0)).not.toStrictEqual(rolls.slice(0, 5));
  });

  it('never changes the world RNG state', () => {
    const start = createWorld(7, [dice(3), blue]).rngState;
    expect(play(7, [dice(3), blue], 30).rngState).toBe(start);
  });

  it('keeps each ball’s draws independent of how much other balls draw', () => {
    // Ball 1's numbers are the same whether ball 0 draws one number a tick or five.
    const light = play(7, [dice(1), dice(2)], 10);
    const heavy = play(7, [dice(5), dice(2)], 10);
    expect(rollsOf(heavy, 1)).toStrictEqual(rollsOf(light, 1));
  });

  it('derives seeds from every part', () => {
    const base = deriveSeed([1, 2, 3, 4, 0]);
    for (const changed of [
      [9, 2, 3, 4, 0],
      [1, 9, 3, 4, 0],
      [1, 2, 9, 4, 0],
      [1, 2, 3, 9, 0],
      [1, 2, 3, 4, 9],
    ]) {
      expect(deriveSeed(changed)).not.toBe(base);
    }
    expect(deriveSeed([1, 2, 3, 4, 0])).toBe(base);
  });
});
