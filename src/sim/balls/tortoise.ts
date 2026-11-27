import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { ZONE_DAMAGE as SHOCKWAVE_DAMAGE } from './quake.ts';
import { ZONE_DAMAGE as STRIKE_DAMAGE } from './storm.ts';

export type TortoiseState = Readonly<Record<string, never>>;

/** What its shell takes off every hit. */
export const SHELL = 3;
/** The shell never takes more than this share of a hit: a small hit still lands half. */
export const SHELL_MOST_SHARE = 0.5;
/** Its cruising speed: slow, but faster than the Frost. */
export const TORTOISE_SPEED = 740;

/** What a hit of `amount` does through the shell (before the sim rounds it). */
export function throughShell(amount: number): number {
  return amount - Math.min(SHELL, amount * SHELL_MOST_SHARE);
}

/**
 * A shell (ADR 0091): every hit it takes, from any source (a bump, a shot, a strike, a burn, a
 * skull, a poison tick), loses SHELL, but never more than SHELL_MOST_SHARE of it (`incomingDamageOf`,
 * ADR 0045). Big hits barely notice; small ones (shockwaves, burns, poison, nips, bites) land at
 * about half. An unblockable hit (the wail) skips it, as it skips every defence (ADR 0075). Its
 * own bump is plain.
 */
export const tortoise = defineBall<TortoiseState>({
  id: 'tortoise',
  name: 'Tortoise',
  description: 'Its shell takes 3 off every hit: small hits land half.',
  color: '#8a9a3b',
  ability: { name: 'Shell', shownBy: { kind: 'hitReduced' }, tipOn: 'self' },
  howItWorks: [
    `Every hit on it loses ${String(SHELL)}, but never more than half: a ${String(SHOCKWAVE_DAMAGE)} shockwave lands at ${String(Math.round(throughShell(SHOCKWAVE_DAMAGE)))}, a ${String(STRIKE_DAMAGE)} strike at ${String(Math.round(throughShell(STRIKE_DAMAGE)))}.`,
    'Bumps, shots, bites, burns and poison alike. Nothing blocks the wail.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: TORTOISE_SPEED,
  maxHealth: 68,
  contactDamage: 21,
  initialAbilityState: {},
  incomingDamageOf: (_self, amount) => throughShell(amount),
  hooks: {},
});
