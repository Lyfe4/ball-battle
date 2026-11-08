import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type BomberState = Readonly<{ nextDropTick: number }>;

/** The first bomb drops on this tick. */
export const FIRST_DROP_TICK = 45;
/** Ticks between bombs. */
export const DROP_TICKS = 130;
/** A bomb's fuse: it goes off by itself this long after it lands (3.5 s), if nobody sets it off. */
export const FUSE_TICKS = 210;
/** It arms this long after it lands, once the Bomber is well clear of it. */
export const ARM_TICKS = 18;
/** World units: the bomb's body, which an enemy ball sets off by touching it. */
export const BOMB_RADIUS = 44;
/** World units: everything inside goes up with it. */
export const BLAST_RADIUS = 100;
/** Ability damage to each enemy ball in the blast. Below the Storm's strike (identity rule). */
export const BLAST_DAMAGE = 12;

/** The Bomber's next drop tick, read from any ball state (undefined for other balls). */
export function nextDropTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextDropTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * Leaves bombs behind it (ADR 0043): a zone (ADR 0006) with a visible fuse that blows after
 * FUSE_TICKS, or at once when an enemy touches it after it arms (a trigger). The faster a ball
 * goes, the more ground it covers and the more bombs it runs into. Skulls and a phased ball pass
 * over a bomb without setting it off, though its blast still catches them.
 */
export const bomber = defineBall<BomberState>({
  id: 'bomber',
  name: 'Bomber',
  description: 'Leaves bombs behind it that blow when touched, or soon after.',
  color: '#f91fce',
  ability: { name: 'Bombs', shownBy: { kind: 'zoneSpawned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 69,
  contactDamage: 11,
  initialAbilityState: { nextDropTick: FIRST_DROP_TICK },
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick < self.abilityState.nextDropTick) return [];
      return [
        {
          kind: 'spawnZone',
          position: self.position,
          radius: BLAST_RADIUS,
          damage: BLAST_DAMAGE,
          delayTicks: FUSE_TICKS,
          trigger: { radius: BOMB_RADIUS, armTicks: ARM_TICKS },
        },
        { kind: 'setAbilityState', state: { nextDropTick: world.tick + DROP_TICKS } },
      ];
    },
  },
});
