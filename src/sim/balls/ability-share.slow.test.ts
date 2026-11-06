// Identity rules that are measured by playing matches: how much of a ball's damage comes from its
// ability. Each plays every opponent for 40 seeds in both slot orders. The rules that read only the
// definitions are in identity.test.ts (unit suite). Breaking one is a design decision, not a tuning
// step.
import { describe, expect, it } from 'vitest';
import { archer } from './archer.ts';
import { ghost } from './ghost.ts';
import { inferno } from './inferno.ts';
import { BALLS } from './index.ts';
import { necromancer } from './necromancer.ts';
import { quake } from './quake.ts';
import { damageDealt, ROSTER_TIMEOUT_MS } from './roster-support.ts';
import { sniper } from './sniper.ts';
import { storm } from './storm.ts';
import { thorns } from './thorns.ts';
import { venom } from './venom.ts';
import type { BallDefinition } from '../types.ts';

/** Share of the damage `ball` dealt across the roster that came from its ability. */
function abilityShare(ball: BallDefinition): number {
  const { ability, total } = damageDealt(
    ball,
    BALLS.filter((other) => other.id !== ball.id),
  );
  expect(total).toBeGreaterThan(0);
  return ability / total;
}

describe('the ball roster (slow): ability share', () => {
  it.each<[string, BallDefinition, number]>([
    ['Archer gets at least half its damage from its arrows', archer, 0.5],
    ['Storm gets at least 40% of its damage from its lightning', storm, 0.4],
    // Reflection is its only ability damage. Measured about 22% (ADR 0013).
    ['Thorns gets a meaningful share of its damage from reflection', thorns, 0.15],
    // Poison is its only ability damage. Measured about 65% (ADR 0014).
    ['Venom gets most of its damage from poison', venom, 0.5],
    // Measured about 60% (ADR 0015).
    ['Sniper gets at least half its damage from its shots', sniper, 0.5],
    // Measured about 40% (ADR 0015).
    ['Quake gets at least 30% of its damage from its shockwaves', quake, 0.3],
    // Measured about 17% (ADR 0026): a pass is rarer than a contact, and weaker.
    ['Ghost gets a meaningful share of its damage from spectral hits', ghost, 0.1],
    // Measured about 46% (ADR 0026).
    ['Necromancer gets at least a third of its damage from its minions', necromancer, 0.33],
    // ADR 0034: its own hits are light; the fire is the ball.
    ['Inferno gets most of its damage from its fire', inferno, 0.5],
  ])('%s', { timeout: ROSTER_TIMEOUT_MS }, (_rule, ball, least) => {
    expect(abilityShare(ball)).toBeGreaterThanOrEqual(least);
  });
});
