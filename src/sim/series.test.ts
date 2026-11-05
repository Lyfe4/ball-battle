import { RULESET_VERSION } from './ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { randomBot } from './bot.ts';
import {
  attemptSeed,
  isValidLineup,
  MAX_ATTEMPTS,
  matchWorld,
  nextMatch,
  outcomeOf,
  playSeries,
  playToEnd,
  recordOutcome,
  roundSeed,
  scoreOf,
  startSeries,
  suddenDeathWinner,
  type Outcome,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { deepFreeze } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);
const setup: SeriesSetup = deepFreeze({
  ruleset: RULESET_VERSION,
  seed: 42,
  a: ['speedster', 'vampire', 'archer'],
  b: ['storm', 'frost', 'quake'],
});

/** Feeds outcomes into a fresh series, as the browser does one match at a time. */
function feed(outcomes: readonly Outcome[], from: SeriesSetup = setup): SeriesState {
  return outcomes.reduce(recordOutcome, startSeries(from));
}

describe('series seeds', () => {
  it('derives each round seed from the series seed and the round, deterministically', () => {
    expect(roundSeed(42, 0)).toBe(roundSeed(42, 0));
    const seeds = [0, 1, 2].map((round) => roundSeed(42, round));
    expect(new Set(seeds).size).toBe(3);
    expect(roundSeed(43, 0)).not.toBe(roundSeed(42, 0));
    for (const seed of seeds) {
      expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffff_ffff).toBe(true);
    }
  });

  it('plays a round on its own seed first, then on seeds derived from it and the attempt', () => {
    const seed = roundSeed(42, 1);
    expect(attemptSeed(seed, 0)).toBe(seed);
    const replays = [1, 2].map((attempt) => attemptSeed(seed, attempt));
    expect(new Set([seed, ...replays]).size).toBe(3);
    expect(attemptSeed(seed, 2)).toBe(attemptSeed(seed, 2));
  });

  it('flips the sudden-death coin from the round seed, both ways across seeds', () => {
    expect(suddenDeathWinner(1234)).toBe(suddenDeathWinner(1234));
    const sides = new Set(Array.from({ length: 64 }, (_, seed) => suddenDeathWinner(seed)));
    expect(sides).toStrictEqual(new Set(['a', 'b']));
  });
});

describe('series rules', () => {
  it('starts with round 1, lineup slot 1 against slot 1, on the round seed', () => {
    expect(nextMatch(startSeries(setup))).toStrictEqual({
      round: 0,
      attempt: 0,
      seed: roundSeed(42, 0),
      a: 'speedster',
      b: 'storm',
    });
  });

  it('stops at 2-0 without playing round 3', () => {
    const state = feed(['a', 'a']);
    expect(state.winner).toBe('a');
    expect(scoreOf(state)).toStrictEqual({ a: 2, b: 0 });
    expect(state.rounds).toHaveLength(2);
    expect(nextMatch(state)).toBeUndefined();
    expect(() => recordOutcome(state, 'b')).toThrow();
  });

  it('plays round 3, third ball against third ball, at 1-1', () => {
    const tied = feed(['a', 'b']);
    expect(tied.winner).toBeUndefined();
    expect(nextMatch(tied)).toMatchObject({ round: 2, a: 'archer', b: 'quake' });
    expect(recordOutcome(tied, 'b').winner).toBe('b');
  });

  it('replays a drawn round on the next attempt seed', () => {
    const drew = feed(['draw']);
    expect(drew.rounds).toHaveLength(0);
    expect(nextMatch(drew)).toMatchObject({
      round: 0,
      attempt: 1,
      seed: attemptSeed(roundSeed(42, 0), 1),
    });
    const won = recordOutcome(drew, 'b');
    expect(won.rounds[0]).toMatchObject({
      outcomes: ['draw', 'b'],
      seeds: [roundSeed(42, 0), attemptSeed(roundSeed(42, 0), 1)],
      winner: 'b',
      suddenDeath: false,
    });
  });

  it(`settles a round that draws ${String(MAX_ATTEMPTS)} times by sudden death`, () => {
    const draws: Outcome[] = Array.from({ length: MAX_ATTEMPTS }, () => 'draw');
    const state = feed(draws);
    expect(state.rounds[0]).toMatchObject({
      outcomes: draws,
      suddenDeath: true,
      winner: suddenDeathWinner(roundSeed(42, 0)),
    });
    expect(state.rounds[0]?.seeds).toHaveLength(MAX_ATTEMPTS);
    expect(nextMatch(state)).toMatchObject({ round: 1, attempt: 0 });
  });

  it('never mutates the state it is given', () => {
    const start = deepFreeze(startSeries(setup));
    expect(() => feed(['draw', 'a', 'b', 'a'], start.setup)).not.toThrow();
    expect(() => recordOutcome(start, 'a')).not.toThrow();
  });
});

describe('lineups', () => {
  it('accepts three different known balls only', () => {
    expect(isValidLineup(['brawler', 'storm', 'venom'], ids)).toBe(true);
    expect(isValidLineup(['brawler', 'brawler', 'venom'], ids)).toBe(false);
    expect(isValidLineup(['brawler', 'storm'], ids)).toBe(false);
    expect(isValidLineup(['brawler', 'storm', 'venom', 'quake'], ids)).toBe(false);
    expect(isValidLineup(['brawler', 'storm', 'nope'], ids)).toBe(false);
  });

  it('gets a valid, seeded lineup from the random bot, varied across seeds', () => {
    expect(randomBot.pickLineup(7, ids)).toStrictEqual(randomBot.pickLineup(7, ids));
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const lineup = randomBot.pickLineup(seed, ids);
      expect(isValidLineup(lineup, ids)).toBe(true);
      lineup.forEach((id) => seen.add(id));
    }
    expect(seen).toStrictEqual(new Set(ids));
    expect(() => randomBot.pickLineup(1, ['brawler', 'storm'])).toThrow();
  });
});

describe('playSeries', () => {
  it('is deterministic: the same setup gives the same series', () => {
    expect(playSeries(setup, BALL_LOOKUP)).toStrictEqual(playSeries(setup, BALL_LOOKUP));
  });

  it('agrees with playing one match at a time, as the browser does', () => {
    let state = startSeries(setup);
    for (let match = nextMatch(state); match !== undefined; match = nextMatch(state)) {
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('expected a finished match');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    expect(state).toStrictEqual(playSeries(setup, BALL_LOOKUP));
    expect(state.winner).toBeDefined();
    expect(state.rounds.length === 2 || state.rounds.length === 3).toBe(true);
  });

  it('replays a real drawn round on a derived seed', () => {
    // Speedster mirrors draw about one time in six; find a series whose first round draws.
    let found: SeriesState | undefined;
    for (let seed = 0; seed < 200 && found === undefined; seed++) {
      const state = playSeries(
        {
          ruleset: RULESET_VERSION,
          seed,
          a: ['speedster', 'brawler', 'storm'],
          b: ['speedster', 'vampire', 'frost'],
        },
        BALL_LOOKUP,
      );
      if (state.rounds[0]?.outcomes[0] === 'draw') found = state;
    }
    const round = found?.rounds[0];
    expect(round).toBeDefined();
    expect(round?.seeds[1]).toBe(attemptSeed(round?.seeds[0] ?? 0, 1));
    expect(round?.outcomes.length).toBeGreaterThan(1);
  });
});
