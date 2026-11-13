import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

export type BerserkerState = Readonly<{ rage: number }>;

/** Bonus contact damage per stored hit of rage. */
export const RAGE_PER_HIT = 3;
/** Most hits of rage it stores. */
export const MAX_RAGE = 3;
/** The most its rage can add to one bump. */
export const RAGE_DAMAGE = RAGE_PER_HIT * MAX_RAGE;

/** The Berserker's stored rage, read from any ball state (0 for other balls). */
export function rageOf(state: Readonly<Record<string, unknown>>): number {
  const rage = state['rage'];
  return typeof rage === 'number' ? rage : 0;
}

/**
 * The most health in the roster (ADR 0015). Every hit it takes, of any kind, stores a point of rage
 * (up to MAX_RAGE); its next bump spends it all as extra contact damage (ADR 0045, group 4). Many small hits (poison ticks, burns, a boomerang, skull bites) fill
 * it fast; a few big ones barely do. Rage hits are contact hits: directness scales them and Thorns
 * reflects them.
 */
export const berserker = defineBall<BerserkerState>({
  id: 'berserker',
  name: 'Berserker',
  description: 'Every hit it takes builds rage; its next bump lets it out.',
  color: '#f97316',
  ability: { name: 'Rage', shownBy: { kind: 'hook', hook: 'onHitBall' } },
  howItWorks: [
    `Every hit it takes, of any kind, stores rage, up to ${MAX_RAGE} hits.`,
    `Its next bump lets it all out: ${RAGE_PER_HIT} extra damage per hit stored, up to ${RAGE_DAMAGE}.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 86,
  contactDamage: 18.2,
  initialAbilityState: { rage: 0 },
  contactDamageOf: (self, stats) => stats.contactDamage + RAGE_PER_HIT * self.abilityState.rage,
  hooks: {
    onHitBall: ({ self }) =>
      self.abilityState.rage === 0 ? [] : [{ kind: 'setAbilityState', state: { rage: 0 } }],
    onDamageTaken: ({ self }) =>
      self.abilityState.rage >= MAX_RAGE
        ? []
        : [{ kind: 'setAbilityState', state: { rage: self.abilityState.rage + 1 } }],
  },
});
