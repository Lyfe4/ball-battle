// Opponents for a best-of-3 series (ADR 0017, 0019). Behind a small interface so a smarter bot (one
// that learns what a player opens with) can replace this one without touching the series or the
// UI. Pure and seeded, like the rest of the sim.
import { isFavoured } from './counter-map.ts';
import { createStream, deriveSeed } from './rng.ts';
import {
  awaitingPick,
  LINEUP_SIZE,
  nextBallOf,
  otherSide,
  remainingOf,
  type Lineup,
  type SeriesState,
} from './series.ts';

export interface LineupBot {
  readonly id: string;
  /** Three different ids from `roster`, in order. The same seed always gives the same lineup. */
  pickLineup(seed: number, roster: readonly string[]): Lineup;
  /** Reveal, then order: its order for its own lineup, once both lineups are revealed. */
  orderLineup(seed: number, own: Lineup, opponent: Lineup): Lineup;
  /**
   * Loser picks next: its ball for round `round` from `remaining`, knowing the winner's next ball
   * (`opponentNext`).
   */
  pickNext(seed: number, round: number, remaining: readonly string[], opponentNext: string): string;
}

/** Keeps each of the bot's choices on its own stream, apart from the series' round seeds. */
const BOT_SALT = 0xb07;
const ORDER_SALT = 0x0de7;
const PICK_SALT = 0x91c4;

/** A seeded shuffle of `ids` (Fisher-Yates). */
function shuffled(ids: readonly string[], random: () => number): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const here = out[i];
    const there = out[j];
    if (here === undefined || there === undefined) continue;
    out[i] = there;
    out[j] = here;
  }
  return out;
}

function asLineup(ids: readonly string[]): Lineup {
  const [first, second, third] = ids;
  if (ids.length !== LINEUP_SIZE || first === undefined || second === undefined || !third) {
    throw new Error('Expected three balls');
  }
  return [first, second, third];
}

/**
 * Picks three different balls uniformly at random, in a random order, and orders them at random
 * when lineups are revealed. When it loses a round and may pick its next ball, it picks a counter
 * to the winner's next ball if the counter map gives it one (at random among several), otherwise
 * any ball it has left.
 */
export const randomBot: LineupBot = {
  id: 'random',
  pickLineup(seed, roster) {
    if (new Set(roster).size < LINEUP_SIZE) {
      throw new Error(`A lineup needs ${String(LINEUP_SIZE)} different balls`);
    }
    const random = createStream(deriveSeed([seed, BOT_SALT]));
    const pool = [...new Set(roster)];
    const picked: string[] = [];
    while (picked.length < LINEUP_SIZE) {
      const index = Math.floor(random() * pool.length);
      picked.push(...pool.splice(index, 1));
    }
    return asLineup(picked);
  },
  orderLineup(seed, own) {
    return asLineup(shuffled(own, createStream(deriveSeed([seed, ORDER_SALT]))));
  },
  pickNext(seed, round, remaining, opponentNext) {
    if (remaining.length === 0) throw new Error('No ball left to pick');
    const counters = remaining.filter((id) => isFavoured(id, opponentNext));
    const pool = counters.length > 0 ? counters : remaining;
    const random = createStream(deriveSeed([seed, PICK_SALT, round]));
    const choice = pool[Math.floor(random() * pool.length)];
    if (choice === undefined) throw new Error('No ball left to pick');
    return choice;
  },
};

/** The bot's pick when side B (the bot) is due to pick in a `loser` series, else undefined. */
export function botPick(bot: LineupBot, state: SeriesState): string | undefined {
  if (awaitingPick(state) !== 'b') return undefined;
  const winnersNext = nextBallOf(state, otherSide('b'));
  if (winnersNext === undefined) return undefined;
  return bot.pickNext(state.setup.seed, state.rounds.length, remainingOf(state, 'b'), winnersNext);
}
