// Every seed a series uses (ADR 0017, 0029, 0051, 0052). A local series and a link derive them all
// from the one series seed, as they always have. A server series names them instead
// (`SeriesSetup.seeds`): each is derived from the server's secret and revealed only after its lock,
// so a player can't play a pick out against a seed before choosing it, and revealing one seed
// gives nothing about another (the derivation below is reversible; HMAC outputs are not). Rules
// read a seed only through these functions, so the two kinds of series can't drift apart.
import { deriveSeed, nextFloat } from './rng.ts';
import type { SeriesSetup, Side } from './series.ts';

/**
 * A server series' own seeds, each a 32-bit unsigned integer: one per round (draws and sudden
 * death derive from it, so a drawn round replays the same way), the Reveal toss, and the seed of
 * the bot's choice stream. The bot's lineup seed is `Opponent.lineupSeed`, already its own field.
 */
export interface SeriesSeeds {
  /** One per round the series can take (`bestOf`). */
  readonly rounds: readonly number[];
  /** Reveal only. */
  readonly toss?: number;
  /** A bot that makes choices (any format but Blind) only. */
  readonly bot?: number;
}

/** Salts, so a round seed, an attempt seed and a coin flip never share a stream. */
const ROUND_SALT = 0x5e7105;
const ATTEMPT_SALT = 0xa77e3b7;
const SUDDEN_DEATH_SALT = 0x5dde47;
/** Reveal's coin toss for who shows first in round 1 (ADR 0029). */
const TOSS_SALT = 0x70557055;

/** The seed of round `round` (0-based) of a series. 32-bit integer maths only, exact everywhere. */
export function roundSeed(seriesSeed: number, round: number): number {
  return deriveSeed([seriesSeed, ROUND_SALT, round]);
}

/** The seed of play `attempt` (0-based) of a round: the round seed first, then derived ones. */
export function attemptSeed(seedOfRound: number, attempt: number): number {
  return attempt === 0 ? seedOfRound : deriveSeed([seedOfRound, ATTEMPT_SALT, attempt]);
}

/** Who wins a round that drew MAX_ATTEMPTS times: a coin flip seeded from the round seed. */
export function suddenDeathWinner(seedOfRound: number): Side {
  return nextFloat(deriveSeed([seedOfRound, SUDDEN_DEATH_SALT])).value < 0.5 ? 'a' : 'b';
}

const sideOfToss = (tossSeed: number): Side => (nextFloat(tossSeed).value < 0.5 ? 'a' : 'b');

/** Reveal's coin toss (ADR 0029) from a series seed alone: the side that shows first in round 1. */
export function revealFirst(seriesSeed: number): Side {
  return sideOfToss(deriveSeed([seriesSeed, TOSS_SALT]));
}

/** The seed of a series' round `round` (0-based): its own, else derived from the series seed. */
export function roundSeedOf(setup: SeriesSetup, round: number): number {
  const seeds = setup.seeds;
  if (seeds === undefined) return roundSeed(setup.seed, round);
  const own = seeds.rounds[round];
  if (own === undefined) throw new Error(`The series has no seed for round ${String(round + 1)}`);
  return own;
}

/** Who shows first in round 1 of a Reveal series: its own toss, else the series seed's. */
export function firstToShowOf(setup: SeriesSetup): Side {
  const toss = setup.seeds?.toss;
  return toss === undefined ? revealFirst(setup.seed) : sideOfToss(toss);
}

/** The seed of the bot's choice stream: its own, else the series seed (as before ADR 0052). */
export const botSeedOf = (setup: SeriesSetup): number => setup.seeds?.bot ?? setup.seed;
