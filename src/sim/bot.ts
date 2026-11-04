// Opponents that pick a lineup for a best-of-3 series (ADR 0017). Behind a small interface so a
// smarter bot (one that counter-picks, or learns what a player opens with) can replace the random
// one without touching the series or the UI. Pure and seeded, like the rest of the sim.
import { createStream, deriveSeed } from './rng.ts';
import { LINEUP_SIZE, type Lineup } from './series.ts';

export interface LineupBot {
  readonly id: string;
  /** Three different ids from `roster`, in order. The same seed always gives the same lineup. */
  pickLineup(seed: number, roster: readonly string[]): Lineup;
}

/** Keeps the bot's draws apart from the series' round seeds. */
const BOT_SALT = 0xb07;

/** Picks three different balls uniformly at random, in a random order. */
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
    const [first, second, third] = picked;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected three picks');
    }
    return [first, second, third];
  },
};
