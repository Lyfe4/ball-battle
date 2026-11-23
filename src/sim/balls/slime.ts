import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { percentOf } from './how-it-works.ts';

export type SlimeState = Readonly<{
  /** True once it has split: both halves carry it, and neither splits again. */
  split: boolean;
}>;

/** It splits the first time a hit leaves it at this share of its full health or less. */
export const SPLIT_AT = 0.5;
/** Each half's radius (a whole Slime is STANDARD_BALL_RADIUS). */
export const HALF_RADIUS = 30;
/** Each half cruises at this multiple of the Slime's speed... */
export const HALF_SPEED = 1.2;
/** ... and bumps for this share of its bump. */
export const HALF_BUMP = 0.85;
/** How far apart the halves' centres start. */
export const HALF_SPREAD = 30;

/** True for a Slime that has split, or either of its halves (any ball state). */
export function isSplitSlime(state: Readonly<Record<string, unknown>>): boolean {
  return state['split'] === true;
}

/**
 * Split (ADR 0060): the first time a hit leaves it at half its health or less, it splits into two
 * small, quicker slimes on its side (the split action, ADR 0059) that share what it has left, the
 * first half taking the odd point. The enemy has to finish both. Any hit, from anything, can split
 * it; a ball split from it never splits again.
 */
export const slime = defineBall<SlimeState>({
  id: 'slime',
  name: 'Slime',
  description: 'At half health it splits in two; finish both to win.',
  color: '#e8f580',
  ability: { name: 'Split', shownBy: { kind: 'split' }, tipOn: 'self' },
  howItWorks: [
    `The first hit that leaves it at ${percentOf(SPLIT_AT)} health or less splits it into two small slimes sharing what is left.`,
    `Each half is ${percentOf(HALF_SPEED - 1)} faster and bumps for ${percentOf(HALF_BUMP)}. Both must be knocked out.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 76,
  contactDamage: 24,
  initialAbilityState: { split: false },
  radiusOf: (self) => (self.abilityState.split ? HALF_RADIUS : STANDARD_BALL_RADIUS),
  cruiseSpeed: (state, stats) => (state.split ? stats.speed * HALF_SPEED : stats.speed),
  contactDamageOf: (self, stats) =>
    self.abilityState.split ? stats.contactDamage * HALF_BUMP : stats.contactDamage,
  hooks: {
    onDamageTaken: ({ self, stats }) => {
      const { health } = self;
      if (self.abilityState.split || health > stats.maxHealth * SPLIT_AT || health < 2) return [];
      // Health can be fractional (a glancing bump): the halves share it in whole points.
      const left = Math.max(2, Math.round(health));
      const keep = Math.ceil(left / 2);
      return [
        { kind: 'setAbilityState', state: { split: true } },
        {
          kind: 'split',
          keepHealth: keep,
          splitHealth: left - keep,
          state: { split: true },
          spread: HALF_SPREAD,
        },
      ];
    },
  },
});
