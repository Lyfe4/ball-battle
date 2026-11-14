// The series screens seen from either side (ADR 0052): online, the player may be side B against a
// named player. Offline is always side A against the bot (BOT_SEATS), as every other test shows.
import { describe, expect, it } from 'vitest';
import {
  recordOutcome,
  recordPick,
  startSeries,
  type SeriesSetup,
  type SeriesState,
} from '../../sim/series.ts';
import { bannerText, finalLine, pickLine, roundLine, scoreLine, tossLine } from '../series-text.ts';
import { playerSeats } from './seats.ts';
import { pairingOf, pickChoiceOf, seriesScreenOf, trackOf } from './series-view.ts';

const setup: SeriesSetup = {
  ruleset: 15,
  seed: 0,
  a: ['archer', 'thorns', 'vampire'],
  b: ['brawler', 'magnet', 'frost'],
  opponent: { kind: 'player' },
  format: 'showdown',
  seeds: { rounds: [1, 2, 3] },
};
const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const asB = playerSeats('b', 'Player 4821');
const fail = (): never => {
  throw new Error('missing');
};

/** Showdown, round 1 opened by both, A winning it. */
function afterRound1(): SeriesState {
  let state = recordPick(recordPick(startSeries(setup), 'archer'), 'frost');
  state = recordOutcome(state, 'a');
  return state;
}

describe('a series seen from side B', () => {
  it('asks B for its Showdown opener while A’s stays hidden, as the server says it is due', () => {
    // B's view of round 1: A's opener is not in it; the server says both are due.
    const state = startSeries(setup);
    expect(pickChoiceOf(state, 'b')).toBeUndefined();
    expect(pickChoiceOf(state, 'b', ['a', 'b'])).toStrictEqual({
      kind: 'open',
      options: setup.b,
      opponents: setup.a,
    });
    expect(pickChoiceOf(state, 'a', ['b'])).toBeUndefined();
    expect(
      seriesScreenOf({
        state,
        current: undefined,
        settled: false,
        linkState: undefined,
        seats: asB,
        due: ['a', 'b'],
      }).actions,
    ).toStrictEqual(['pick']);
  });

  it('puts B’s balls in the track’s own row and A’s across', () => {
    const [column] = trackOf(afterRound1(), undefined, 'b');
    expect(column?.you).toStrictEqual({ ball: 'frost', result: 'lost' });
    expect(column?.bot).toStrictEqual({ ball: 'archer', result: 'won' });
  });

  it('pairs the coming round from B’s side', () => {
    // Round 2: A won round 1, so A shows first; B waits on it.
    const state = recordPick(afterRound1(), 'thorns');
    expect(pairingOf(state, 'b')).toBeUndefined();
    expect(pickChoiceOf(state, 'b')).toMatchObject({ kind: 'answer', facing: 'thorns' });
  });

  it('says it all from B’s side, naming the other player', () => {
    const state = afterRound1();
    expect(scoreLine(state, asB)).toBe('You 0 – 1 Player 4821');
    expect(roundLine(state.rounds[0] ?? fail(), nameOf, asB)).toBe(
      'Round 1: Player 4821’s Archer beat your Frost',
    );
    expect(tossLine('a', asB)).toBe('Coin toss: Player 4821 shows first.');
    expect(tossLine('b', asB)).toBe('Coin toss: you show first.');
    const won = recordOutcome(recordPick(recordPick(state, 'thorns'), 'magnet'), 'a');
    expect(finalLine(won, asB)).toBe('Player 4821 wins the series 2–0.');
  });

  it('names who is answered, and never calls a player "it"', () => {
    const choice = {
      kind: 'answer',
      facing: 'archer',
      options: setup.b,
      opponents: setup.a,
    } as const;
    expect(bannerText(choice, nameOf, 'a', asB).lead).toBe(
      'Coin toss: Player 4821 shows first. They play Archer.',
    );
    expect(pickLine(choice, 0, setup.a, nameOf, undefined, asB)).toBe(
      'Round 1: Player 4821 plays Archer. Pick your answer.',
    );
  });

  it('names a deleted opponent', () => {
    expect(playerSeats('a', null).them).toBe('Deleted player');
  });
});
