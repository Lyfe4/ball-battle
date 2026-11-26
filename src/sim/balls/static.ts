import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { AbilityAction } from '../types.ts';

export type StaticState = Readonly<{
  /** Hits taken since its last spark. */
  charge: number;
}>;

/** Hits it takes (any kind, any size) to spark. */
export const CHARGE_TO_SPARK = 2;
/** How far a spark reaches, from its centre to the hit ball's edge. */
export const SPARK_RADIUS = 300;
/** What a spark deals to every enemy ball in reach. */
export const SPARK_DAMAGE = 12;

/**
 * Static (prototype, Track C1): every hit it takes, of any kind and size, builds a charge; every
 * CHARGE_TO_SPARKth hit sparks every enemy ball within SPARK_RADIUS for SPARK_DAMAGE. Hits are
 * counted, not damage: many small hits (shockwaves, burns, poison, two-way boomerangs, a side of two
 * halves) spark it often; one big hit now and then hardly at all. A first try counted touches
 * instead; it came out flat (no strong counters at a fair rate).
 */
export const staticBall = defineBall<StaticState>({
  id: 'static',
  name: 'Static',
  description: 'Every second hit it takes sparks every enemy around it.',
  color: '#38bdf8',
  ability: { name: 'Spark', shownBy: { kind: 'hookDamage', hook: 'onDamageTaken' }, tipOn: 'self' },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 80,
  contactDamage: 14,
  initialAbilityState: { charge: 0 },
  hooks: {
    onDamageTaken: ({ world, self }) => {
      const charge = self.abilityState.charge + 1;
      if (charge < CHARGE_TO_SPARK) return [{ kind: 'setAbilityState', state: { charge } }];
      const actions: AbilityAction<StaticState>[] = [
        { kind: 'setAbilityState', state: { charge: 0 } },
      ];
      for (const ball of world.balls) {
        if (sideOf(ball) === sideOf(self) || ball.health <= 0) continue;
        const dx = ball.position.x - self.position.x;
        const dy = ball.position.y - self.position.y;
        const reach = SPARK_RADIUS + ball.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          actions.push({ kind: 'damage', targetId: ball.id, amount: SPARK_DAMAGE });
        }
      }
      return actions;
    },
  },
});
