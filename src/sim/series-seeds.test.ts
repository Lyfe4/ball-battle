// Explicit seeds (ADR 0051 option B, ADR 0052 "Seeds"): a server series names every seed it uses,
// each one secret until its lock, so nothing in it is derived from a seed a player could know.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { botViewOf, hardBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import {
  attemptSeed,
  nextMatch,
  recordPick,
  revealTurnsOf,
  setupWithPicks,
  startSeries,
  type SeriesSetup,
} from './series.ts';
import { firstToShowOf, roundSeedOf } from './series-seeds.ts';
import { verifySeries } from './series-verify.ts';
import { playLikeTheGame, WHOLE_RUN_TIMEOUT_MS } from './test-support.ts';

const ids = BALLS.map((ball) => ball.id);
const lineupSeed = 0x1234_5678;
const rounds = [0xdead_beef, 17, 0x8000_0000];

/** A Reveal series against the Hard bot whose every seed is explicit. */
const seeded = (seed: number, toss: number, bot = 99): SeriesSetup => ({
  ruleset: RULESET_VERSION,
  seed,
  a: ids.slice(3, 6),
  b: hardBot.pickLineup(lineupSeed, ids),
  opponent: { kind: 'bot', bot: hardBot.id, lineupSeed },
  format: 'reveal',
  seeds: { rounds, toss, bot },
});

describe('a series with explicit seeds', () => {
  it('plays each round on its own seed, and replays a drawn round from it', () => {
    const blind: SeriesSetup = {
      ruleset: RULESET_VERSION,
      seed: 1,
      a: ids.slice(0, 3),
      b: ids.slice(3, 6),
      opponent: { kind: 'player' },
      seeds: { rounds },
    };
    expect(nextMatch(startSeries(blind))?.seed).toBe(rounds[0]);
    expect(rounds.map((_, round) => roundSeedOf(blind, round))).toStrictEqual(rounds);
    expect(attemptSeed(roundSeedOf(blind, 2), 0)).toBe(rounds[2]);
  });

  it('tosses for who shows first with its toss seed', () => {
    const tosses = Array.from({ length: 16 }, (_, toss) => firstToShowOf(seeded(5, toss)));
    expect(new Set(tosses)).toStrictEqual(new Set(['a', 'b']));
    const toss = tosses.indexOf('b');
    expect(revealTurnsOf(seeded(5, toss))[0]).toStrictEqual(['b', 'a']);
    expect(revealTurnsOf(seeded(6, toss))[0]).toStrictEqual(['b', 'a']);
  });

  it("draws the bot's choices from its bot seed, never the series seed", () => {
    const toss = Array.from({ length: 16 }, (_, n) => n).find(
      (n) => firstToShowOf(seeded(5, n)) === 'a',
    );
    const setup = seeded(5, toss ?? 0);
    const answering = recordPick(startSeries(setup), ids[3] ?? '');
    expect(botViewOf(answering)?.seed).toBe(99);
  });

  it(
    'decides nothing from the series seed: another one plays the same series, and verifies',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    () => {
      const first = playLikeTheGame(seeded(1, 3), BALL_LOOKUP);
      const second = playLikeTheGame(seeded(0xffff_ffff, 3), BALL_LOOKUP);
      expect(second.rounds).toStrictEqual(first.rounds);
      expect(second.picks).toStrictEqual(first.picks);
      const verdict = verifySeries(setupWithPicks(first), BALL_LOOKUP);
      expect(verdict.ok && verdict.state.rounds).toStrictEqual(first.rounds);
    },
  );
});
