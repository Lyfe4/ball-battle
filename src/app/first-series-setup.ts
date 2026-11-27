// What the guided first series plays (ADR 0090): Best of 3 · Reveal against the Easy bot (D1), on a
// seed stepped so the bot shows first in round 1 (D2), so the player's first choice is an answer,
// which a ▲ can win. It is a choice of seed and level, never a sim rule: Reveal's toss is a pure
// function of the series seed (`revealFirst`), so a stepped seed changes nothing a verifier checks.
// The stepping is bounded and deterministic: browser tests pin `generateSeed` to one value, where a
// "reroll until it suits" loop could never end. No DOM here: the measuring script imports it.
import { easyBot } from '../sim/bot.ts';
import type { BestOf, Format } from '../sim/series.ts';
import { revealFirst } from '../sim/series-seeds.ts';

/**
 * The first series: Best of 3 · Reveal · vs Easy bot, Best of 3 for fewer picks and a shorter first
 * series though a new series is Best of 5 after it (ADR 0090 addendum). Never saved as Play's.
 */
export const FIRST_SERIES: {
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly level: string;
} = {
  format: 'reveal',
  bestOf: 3,
  level: easyBot.id,
};

/**
 * Pick for me's lineup: three balls whose ability reads at a glance (a fighter, a shooter, a
 * poisoner), named by id so the roster's size and order never matter. A ball missing from the build
 * is left out by `starterTrio`.
 */
export const STARTER_TRIO: readonly string[] = ['brawler', 'archer', 'venom'];

/**
 * Pick for me's three balls among `roster`: the starter trio, any it lacks filled from the roster in
 * its order. Never fewer than three while the roster has three.
 */
export function starterTrio(roster: readonly string[]): readonly string[] {
  const chosen = STARTER_TRIO.filter((id) => roster.includes(id));
  for (const id of roster) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen.slice(0, 3);
}

/** How many seeds after the first are tried before the toss is left as it fell. */
export const SEED_STEPS = 64;

/**
 * `seed` if the bot shows first in round 1 of a Reveal series on it, else the nearest seed after it
 * (wrapping at 2^32) that does, within SEED_STEPS; past that, `seed` itself.
 */
export function botShowsFirstSeed(seed: number): number {
  for (let step = 0; step <= SEED_STEPS; step++) {
    const candidate = (seed + step) >>> 0;
    if (revealFirst(candidate) === 'b') return candidate;
  }
  return seed;
}
