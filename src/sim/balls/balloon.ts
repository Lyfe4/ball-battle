import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { DamageVia } from '../types.ts';
import { percentOf } from './how-it-works.ts';

/** Share of an area hit (fire, a bomb, a shockwave, lightning) that lands: it floats over them. */
export const AREA_SHARE = 0.55;
/** How much harder a shot hits it: a shot pops a balloon. */
export const SHOT_TIMES = 1.4;

/** True for the hits that strike the court: a zone's strike or a lasting zone's pulse. */
export function isAreaHit(via: DamageVia | 'contact'): boolean {
  return via === 'zone' || via === 'zonePulse';
}

/**
 * Floats (ADR 0075): area hits pass under it, so a strike, blast, shockwave or burn lands at
 * AREA_SHARE, and anything shot at it lands SHOT_TIMES as hard. Bumps, skulls, poison and hooks'
 * own damage land as they are. Its defence reads what dealt the hit (`via`), on both damage paths.
 */
export const balloon = defineBall({
  id: 'balloon',
  name: 'Balloon',
  description: 'Floats: area hits do half; shots hit it harder.',
  color: '#ff6b6b',
  ability: { name: 'Float', shownBy: { kind: 'hitReduced' }, tipOn: 'self' },
  howItWorks: [
    `Fire, bombs, shockwaves and lightning land at ${percentOf(AREA_SHARE)}: they pass under it.`,
    `Every shot hits it for ${percentOf(SHOT_TIMES)}. Bumps land as they are.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 76,
  contactDamage: 24,
  initialAbilityState: {},
  incomingDamageOf: (_self, amount, _tick, via) =>
    isAreaHit(via) ? amount * AREA_SHARE : via === 'projectile' ? amount * SHOT_TIMES : amount,
  hooks: {},
});
