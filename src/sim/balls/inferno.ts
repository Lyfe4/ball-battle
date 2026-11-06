import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** A burning patch is dropped every this many ticks, where the Inferno is. */
export const DROP_EVERY_TICKS = 20;
export const PATCH_RADIUS = 55;
/** How long a patch burns after it catches, and how often it burns what is inside it. */
export const PATCH_TICKS = 120;
export const BURN_EVERY_TICKS = 15;
/** Ability damage each burn deals to every enemy ball inside. */
export const BURN_DAMAGE = 3;
/** A patch catches this long after it is dropped, so the Inferno is clear of it. */
export const CATCH_TICKS = 20;

/**
 * Leaves a trail of short-lived burning patches (ADR 0034): lasting zones (ADR 0006) that burn
 * every enemy ball inside on a fixed rhythm, and burn up enemy minions. A slow ball lingers in the
 * fire; a fast one is through it before it burns twice.
 */
export const inferno = defineBall({
  id: 'inferno',
  name: 'Inferno',
  description: 'Leaves a trail of fire that burns enemies who cross it.',
  color: '#fdba74',
  ability: { name: 'Fire trail', shownBy: { kind: 'zoneSpawned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 70,
  contactDamage: 7,
  initialAbilityState: {},
  hooks: {
    onTick: ({ world, self }) =>
      world.tick % DROP_EVERY_TICKS === 0
        ? [
            {
              kind: 'spawnZone',
              position: self.position,
              radius: PATCH_RADIUS,
              damage: BURN_DAMAGE,
              delayTicks: CATCH_TICKS,
              linger: { ticks: PATCH_TICKS, pulseEveryTicks: BURN_EVERY_TICKS },
            },
          ]
        : [],
  },
});
