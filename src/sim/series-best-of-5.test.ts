// Best of 5 (ADR 0048): five balls a lineup, first to three, the same three formats. Best of 3 is
// what a setup without `bestOf` means, and its rules are unchanged (series.test.ts, and the
// ruleset fingerprint, which covers every Best of 3 bot choice and series).
import { describe, expect, it } from 'vitest';
import { BALLS } from './balls/index.ts';
import { randomBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import {
  awaitingPick,
  isValidLineup,
  nextMatch,
  recordOutcome,
  recordPick,
  remainingOf,
  revealFirst,
  revealTurnsOf,
  showdownTurnsOf,
  startSeries,
  type Format,
  type Outcome,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { deepFreeze } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);
const A = ['speedster', 'vampire', 'archer', 'thorns', 'venom'];
const B = ['storm', 'frost', 'quake', 'brawler', 'sniper'];

const setupOf = (format: Format, seed = 42): SeriesSetup =>
  deepFreeze({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'player' },
    seed,
    a: A,
    b: B,
    bestOf: 5,
    ...(format === 'blind' ? {} : { format }),
  });

/** Every pick due made with the side's first ball left; `outcomes` fed one match at a time. */
function play(setup: SeriesSetup, outcomes: readonly Outcome[]): SeriesState {
  let state = startSeries(setup);
  for (const outcome of outcomes) {
    for (let due = awaitingPick(state); due !== undefined; due = awaitingPick(state)) {
      state = recordPick(state, remainingOf(state, due)[0] ?? '');
    }
    state = recordOutcome(state, outcome);
  }
  return state;
}

describe('a Best of 5', () => {
  it('takes five different known balls a side, and a Best of 3 still three', () => {
    expect(isValidLineup(A, ids, 5)).toBe(true);
    expect(isValidLineup(A, ids, 3)).toBe(false);
    expect(isValidLineup(A.slice(0, 3), ids, 5)).toBe(false);
    expect(isValidLineup(['storm', 'storm', 'frost', 'quake', 'venom'], ids, 5)).toBe(false);
  });

  it('is won at three round wins, and stops there: a 3-0 plays no round 4', () => {
    const state = play(setupOf('blind'), ['a', 'a', 'a']);
    expect(state.winner).toBe('a');
    expect(state.rounds).toHaveLength(3);
    expect(nextMatch(state)).toBeUndefined();
    expect(() => recordOutcome(state, 'b')).toThrow(/decided/);
    // Two wins do not take it, as they would a Best of 3.
    expect(play(setupOf('blind'), ['b', 'b']).winner).toBeUndefined();
    expect(play(setupOf('blind'), ['b', 'a', 'b', 'b']).winner).toBe('b');
  });

  it('goes to a fifth round at 2-2, played with each side’s last ball', () => {
    const state = play(setupOf('reveal'), ['a', 'b', 'a', 'b']);
    expect(state.winner).toBeUndefined();
    expect(awaitingPick(state)).toBeUndefined();
    const fifth = nextMatch(state);
    expect(fifth?.round).toBe(4);
    expect([fifth?.a, fifth?.b]).toStrictEqual([
      remainingOf(state, 'a')[0],
      remainingOf(state, 'b')[0],
    ]);
    expect(recordOutcome(state, 'b').winner).toBe('b');
  });

  it('replays a draw on a new seed and settles three draws by sudden death, in any round', () => {
    const drawn = play(setupOf('blind'), ['a', 'b', 'a', 'draw', 'draw']);
    expect(drawn.rounds).toHaveLength(3);
    expect(drawn.pending).toHaveLength(2);
    expect(nextMatch(drawn)?.attempt).toBe(2);
    const settled = recordOutcome(drawn, 'draw');
    expect(settled.rounds.at(-1)?.suddenDeath).toBe(true);
    expect(settled.rounds.at(-1)?.outcomes).toStrictEqual(['draw', 'draw', 'draw']);
  });

  it('alternates who shows first in Reveal, from the coin toss, and forces the last round', () => {
    for (const seed of [4, 5]) {
      const first = revealFirst(seed);
      const second = first === 'a' ? 'b' : 'a';
      expect(revealTurnsOf(setupOf('reveal', seed))).toStrictEqual([
        [first, second],
        [second, first],
        [first, second],
        [second, first],
      ]);
      // Best of 3 is unchanged: two rounds of picks.
      const short = { ...setupOf('reveal', seed), a: A.slice(0, 3), b: B.slice(0, 3) };
      const { ruleset, opponent, a, b, format } = short;
      expect(
        revealTurnsOf({ ruleset, opponent, seed, a, b, ...(format ? { format } : {}) }),
      ).toHaveLength(2);
    }
  });

  it('lets the winner of each round show first in Showdown, after an opener picked together', () => {
    const setup = setupOf('showdown');
    expect(showdownTurnsOf(startSeries(setup))).toStrictEqual([['a', 'b']]);
    const state = play(setup, ['b', 'a', 'a']);
    expect(showdownTurnsOf(state)).toStrictEqual([
      ['a', 'b'],
      ['b', 'a'],
      ['a', 'b'],
      ['a', 'b'],
    ]);
    // Round 4 (2-1 to the player): the player won round 3, so shows first.
    expect(awaitingPick(state)).toBe('a');
    const shown = recordPick(state, remainingOf(state, 'a')[0] ?? '');
    expect(awaitingPick(shown)).toBe('b');
    // At 2-2 the fifth round has no picks.
    const level = recordOutcome(recordPick(shown, remainingOf(shown, 'b')[0] ?? ''), 'b');
    expect(awaitingPick(level)).toBeUndefined();
    expect(nextMatch(level)?.round).toBe(4);
  });

  it('gives the bot a five-ball lineup that starts with its Best of 3 lineup', () => {
    for (let seed = 0; seed < 50; seed++) {
      const five = randomBot.pickLineup(seed, ids, 5);
      expect(isValidLineup(five, ids, 5)).toBe(true);
      expect(five.slice(0, 3)).toStrictEqual(randomBot.pickLineup(seed, ids));
    }
  });
});
