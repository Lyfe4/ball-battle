// Reading a server series' explicit seeds (ADR 0052): every seed the series uses and no other, so a
// stored setup has one form and no rule falls back to the series seed by accident.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from './balls/index.ts';
import { hardBot } from './bot.ts';
import { RULESET_VERSION } from './ruleset.ts';
import type { SeriesSetup } from './series.ts';
import { decodeSeriesSetup } from './series-decode.ts';

const roster = [...BALL_LOOKUP.keys()];

const reveal: SeriesSetup = {
  ruleset: RULESET_VERSION,
  seed: 0,
  a: ['archer', 'ghost', 'speedster'],
  b: hardBot.pickLineup(9, roster),
  opponent: { kind: 'bot', bot: hardBot.id, lineupSeed: 9 },
  format: 'reveal',
  seeds: { rounds: [1, 2, 0xffff_ffff], toss: 4, bot: 5 },
};

const reasonOf = (raw: unknown) => {
  const decoded = decodeSeriesSetup(raw, roster);
  return decoded.ok ? 'ok' : decoded.reason;
};
const withSeeds = (seeds: unknown, setup: object = reveal) => ({ ...setup, seeds });

describe('decodeSeriesSetup, explicit seeds', () => {
  it('reads every seed a series uses as a fresh copy', () => {
    const decoded = decodeSeriesSetup(JSON.parse(JSON.stringify(reveal)), roster);
    expect(decoded).toStrictEqual({ ok: true, setup: reveal });
    expect(decoded.ok && decoded.setup.seeds).not.toBe(reveal.seeds);
    const blind = { ...reveal, format: 'blind', opponent: { kind: 'player' } };
    expect(reasonOf(withSeeds({ rounds: [1, 2, 3] }, blind))).toBe('ok');
    const bo5 = {
      ...reveal,
      a: roster.slice(0, 5),
      b: hardBot.pickLineup(9, roster, 5),
      bestOf: 5,
    };
    expect(reasonOf(withSeeds({ rounds: [1, 2, 3, 4, 5], toss: 0, bot: 0 }, bo5))).toBe('ok');
  });

  it('refuses seeds that are not an object of known fields', () => {
    for (const seeds of [null, 7, [], 'seeds']) {
      expect(reasonOf(withSeeds(seeds))).toBe('The seeds are not an object');
    }
    expect(reasonOf(withSeeds({ ...reveal.seeds, lineup: 3 }))).toBe(
      'Unknown seeds field "lineup"',
    );
  });

  it('refuses round seeds that are not one 32-bit integer per round', () => {
    for (const rounds of [
      [1, 2],
      [1, 2, 3, 4],
      [1, 2, -1],
      [1, 2, 0x1_0000_0000],
      [1, 2, 1.5],
      3,
    ]) {
      expect(reasonOf(withSeeds({ ...reveal.seeds, rounds }))).toBe(
        'The round seeds are not one 32-bit integer per round',
      );
    }
    // eslint-disable-next-line no-sparse-arrays -- a hole is what a hostile caller could send
    expect(reasonOf(withSeeds({ ...reveal.seeds, rounds: [1, , 3] }))).toBe(
      'The round seeds are not one 32-bit integer per round',
    );
    const long = Array.from({ length: 100_000 }, () => 1);
    expect(reasonOf(withSeeds({ ...reveal.seeds, rounds: long }))).toBe(
      'The round seeds are not one 32-bit integer per round',
    );
  });

  it('needs a toss seed for Reveal only, and a bot seed for a bot that chooses only', () => {
    const rounds = reveal.seeds?.rounds;
    expect(reasonOf(withSeeds({ rounds, bot: 5 }))).toBe('A Reveal series needs a toss seed');
    expect(reasonOf(withSeeds({ ...reveal.seeds, toss: '4' }))).toBe(
      'A Reveal series needs a toss seed',
    );
    const showdown = { ...reveal, format: 'showdown' };
    expect(reasonOf(withSeeds(reveal.seeds, showdown))).toBe(
      'Only a Reveal series has a toss seed',
    );
    expect(reasonOf(withSeeds({ rounds, toss: 4 }))).toBe('A bot that chooses needs a bot seed');
    const player = { ...reveal, opponent: { kind: 'player' } };
    expect(reasonOf(withSeeds(reveal.seeds, player))).toBe(
      'Only a bot that chooses has a bot seed',
    );
    const blind = { ...reveal, format: 'blind' };
    expect(reasonOf(withSeeds({ rounds, bot: 5 }, blind))).toBe(
      'Only a bot that chooses has a bot seed',
    );
  });
});
