import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { AbilityAction, BallState } from '../types.ts';
import { secondsOf } from './how-it-works.ts';

export type BansheeState = Readonly<{
  /** The tick of its next wail. */
  nextWailTick: number;
}>;

/** Its first wail, 2 s in. */
export const FIRST_WAIL_TICK = 120;
/** Ticks from one wail to the next. */
export const WAIL_EVERY_TICKS = 170;
/** How far a wail reaches, from its centre to the hit ball's edge: about a third of the court. */
export const WAIL_RADIUS = 320;
/** What a wail deals to every enemy ball in reach, whole: nothing blocks it. */
export const WAIL_DAMAGE = 33;

/** The Banshee's next wail tick, read from any ball state (undefined for other balls). */
export function nextWailTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextWailTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * Wails (ADR 0075): every WAIL_EVERY_TICKS it hits every enemy ball within WAIL_RADIUS for
 * WAIL_DAMAGE, and nothing blocks it: no shield, phasing or floating takes any of it (an
 * `unblockable` damage action). Its own bump is weak, so most of what it deals is the wail.
 */
export const banshee = defineBall<BansheeState>({
  id: 'banshee',
  name: 'Banshee',
  description: 'Every few seconds it wails all around; nothing blocks it.',
  color: '#a0729f',
  ability: { name: 'Wail', shownBy: { kind: 'hookDamage', hook: 'onTick' } },
  howItWorks: [
    `Every ${secondsOf(WAIL_EVERY_TICKS)} s it wails: ${WAIL_DAMAGE} to every enemy within ${WAIL_RADIUS}, a third of the court.`,
    'No shield, phasing or floating takes any of it. Its bump is weak.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 56,
  contactDamage: 4,
  initialAbilityState: { nextWailTick: FIRST_WAIL_TICK },
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick < self.abilityState.nextWailTick) return [];
      const actions: AbilityAction<BansheeState>[] = [
        { kind: 'setAbilityState', state: { nextWailTick: world.tick + WAIL_EVERY_TICKS } },
      ];
      for (const ball of world.balls) {
        if (sideOf(ball) === sideOf(self) || ball.health <= 0) continue;
        const dx = ball.position.x - self.position.x;
        const dy = ball.position.y - self.position.y;
        const reach = WAIL_RADIUS + ball.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          actions.push({
            kind: 'damage',
            targetId: ball.id,
            amount: WAIL_DAMAGE,
            unblockable: true,
          });
        }
      }
      return actions;
    },
  },
});
