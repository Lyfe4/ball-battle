// Opponents for a best-of-3 series (ADR 0017, 0019, 0021). Behind a small interface so a smarter bot (one
// that learns what a player opens with) can replace this one without touching the series or the
// UI. Pure and seeded, like the rest of the sim.
import { isFavoured } from './counter-map.ts';
import { createStream, deriveSeed } from './rng.ts';
import {
  awaitingPick,
  formatOf,
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
  /**
   * Reveal (ADR 0021), round 1: the ball it shows first, from its own lineup. It has nothing to
   * react to yet, so a seeded random choice is the fair one: any rule the player could learn would
   * hand them the answer.
   */
  showFirst(seed: number, own: Lineup): string;
  /**
   * Reveal, round 2: its answer to the ball the opponent showed first, from the balls it has left:
   * its best counter by the counter map (favoured, else even, else unfavoured).
   */
  answer(seed: number, round: number, remaining: readonly string[], shown: string): string;
  /**
   * Loser picks next: its ball for round `round` from `remaining`, knowing the winner's next ball
   * (`opponentNext`).
   */
  pickNext(seed: number, round: number, remaining: readonly string[], opponentNext: string): string;
}

/** Keeps each of the bot's choices on its own stream, apart from the series' round seeds. */
const BOT_SALT = 0xb07;
const SHOW_SALT = 0x5409;
const ANSWER_SALT = 0xa45e;
const PICK_SALT = 0x91c4;

function asLineup(ids: readonly string[]): Lineup {
  const [first, second, third] = ids;
  if (ids.length !== LINEUP_SIZE || first === undefined || second === undefined || !third) {
    throw new Error('Expected three balls');
  }
  return [first, second, third];
}

/**
 * Picks three different balls uniformly at random, in a random order. In reveal (ADR 0021) it shows
 * a random ball first in round 1 and answers the player's round-2 ball with its best counter. When
 * it loses a round in loser-picks-next and may pick its next ball, it picks a counter to the
 * winner's next ball if the counter map gives it one (at random among several), otherwise any
 * ball it has left.
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
  showFirst(seed, own) {
    const random = createStream(deriveSeed([seed, SHOW_SALT]));
    const choice = own[Math.floor(random() * own.length)];
    if (choice === undefined) throw new Error('No ball to show');
    return choice;
  },
  answer(seed, round, remaining, shown) {
    // Favoured beats even beats unfavoured; ties go to a seeded coin, so the bot isn't predictable
    // between balls the map rates the same.
    const rank = (id: string) => (isFavoured(id, shown) ? 2 : isFavoured(shown, id) ? 0 : 1);
    const best = Math.max(...remaining.map(rank));
    const pool = remaining.filter((id) => rank(id) === best);
    const random = createStream(deriveSeed([seed, ANSWER_SALT, round]));
    const choice = pool[Math.floor(random() * pool.length)];
    if (choice === undefined) throw new Error('No ball left to answer with');
    return choice;
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

/** The bot's pick when side B (the bot) is due to pick, else undefined. */
export function botPick(bot: LineupBot, state: SeriesState): string | undefined {
  if (awaitingPick(state) !== 'b') return undefined;
  const round = state.rounds.length;
  if (formatOf(state.setup) === 'reveal') {
    const shown = state.picks.find((pick) => pick.round === round && pick.side === 'a');
    return shown === undefined
      ? bot.showFirst(state.setup.seed, state.setup.b)
      : bot.answer(state.setup.seed, round, remainingOf(state, 'b'), shown.ball);
  }
  const winnersNext = nextBallOf(state, otherSide('b'));
  if (winnersNext === undefined) return undefined;
  return bot.pickNext(state.setup.seed, state.rounds.length, remainingOf(state, 'b'), winnersNext);
}
