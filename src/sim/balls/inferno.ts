import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/**
 * A burning patch is dropped every this many ticks, where the Inferno is: a whole number of burns,
 * so every patch burns on the same beat and one never stacks on another (ADR 0045).
 */
export const DROP_EVERY_TICKS = 26;
export const PATCH_RADIUS = 62;
/** How long a patch burns after it catches, and how often it burns what is inside it. */
export const PATCH_TICKS = 130;
export const BURN_EVERY_TICKS = 13;
/** Ability damage each burn deals to every enemy ball inside. */
export const BURN_DAMAGE = 3;
/** A patch catches this long after it is dropped, so the Inferno is clear of it. */
export const CATCH_TICKS = 20;

/**
 * Leaves a trail of short-lived burning patches (ADR 0034): lasting zones (ADR 0006) that burn
 * every enemy ball inside on a fixed rhythm, and burn up enemy minions. The whole trail burns on one
 * beat, and a ball standing in several patches is burned once (one owner's lasting zones never
 * stack, ADR 0045): a steady drip of small burns, so armor takes a share of each, a fade makes a few
 * miss and regrowth keeps up. A slow ball lingers in the fire; a fast one is soon through it.
 */
export const inferno = defineBall({
  id: 'inferno',
  name: 'Inferno',
  description: 'Leaves a trail of fire that burns. Its burns never stack.',
  color: '#fdba74',
  ability: { name: 'Fire trail', shownBy: { kind: 'zoneSpawned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 75,
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
