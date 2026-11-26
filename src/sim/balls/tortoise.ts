import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

export type TortoiseState = Readonly<Record<string, never>>;

/** What its shell takes off every hit. */
export const SHELL = 3;
/** The shell never takes more than this share of a hit: a small hit still lands half. */
export const SHELL_MOST_SHARE = 0.5;

/** What a hit of `amount` does through the shell (before the sim rounds it). */
export function throughShell(amount: number): number {
  return amount - Math.min(SHELL, amount * SHELL_MOST_SHARE);
}

/**
 * A shell (prototype, Track C1): every hit it takes, from any source, loses SHELL, but never more
 * than SHELL_MOST_SHARE of it. Big hits barely notice; small ones (shockwaves, burns, poison, nips,
 * bites) land at about half. Unblockable hits (the wail) skip it, as they skip every defence.
 */
export const tortoise = defineBall<TortoiseState>({
  id: 'tortoise',
  name: 'Tortoise',
  description: 'Its shell takes 3 off every hit: small hits land half.',
  color: '#65a30d',
  ability: { name: 'Shell', shownBy: { kind: 'hitReduced' }, tipOn: 'self' },
  radius: STANDARD_BALL_RADIUS,
  speed: 740,
  maxHealth: 68,
  contactDamage: 21,
  initialAbilityState: {},
  incomingDamageOf: (_self, amount) => throughShell(amount),
  hooks: {},
});
