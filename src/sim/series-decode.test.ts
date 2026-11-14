import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from './balls/index.ts';
import { randomBot } from './bot.ts';
import { createStream } from './rng.ts';
import { RULESET_VERSION } from './ruleset.ts';
import type { SeriesSetup } from './series.ts';
import { decodeSeriesSetup, parseSeriesSetup } from './series-decode.ts';

const roster = [...BALL_LOOKUP.keys()];

/** A Showdown series against the bot, as a link or save holds one (the picks' legality is not this module's). */
const valid: SeriesSetup = {
  ruleset: RULESET_VERSION,
  seed: 7,
  a: ['archer', 'ghost', 'speedster'],
  b: randomBot.pickLineup(7, roster),
  opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 7 },
  format: 'showdown',
  picks: ['archer'],
};

const reasonOf = (raw: unknown) => {
  const decoded = decodeSeriesSetup(raw, roster);
  return decoded.ok ? 'ok' : decoded.reason;
};
const without = (...keys: string[]) =>
  Object.fromEntries(Object.entries(valid).filter(([name]) => !keys.includes(name)));
const botWith = (fields: Record<string, unknown>) => ({
  ...valid,
  opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 7, ...fields },
});

describe('decodeSeriesSetup', () => {
  it('reads a valid setup as a fresh copy of the same series', () => {
    const decoded = decodeSeriesSetup(JSON.parse(JSON.stringify(valid)), roster);
    expect(decoded).toStrictEqual({ ok: true, setup: valid });
    expect(decoded.ok && decoded.setup).not.toBe(valid);
    expect(reasonOf(without('format'))).toBe('ok');
    expect(reasonOf({ ...valid, format: 'blind' })).toBe('ok');
    expect(reasonOf({ ...without('picks'), bestOf: 3 })).toBe('ok');
    expect(reasonOf({ ...valid, opponent: { kind: 'player' } })).toBe('ok');
  });

  // A series has one stored form (ADR 0051): a default written out and a default left out are the
  // same series, so they must store and compare alike.
  it('leaves out a field that only holds its default', () => {
    const setupOf = (raw: unknown) => {
      const decoded = decodeSeriesSetup(raw, roster);
      return decoded.ok ? decoded.setup : decoded.reason;
    };
    const plain = without('picks');
    expect(setupOf({ ...plain, bestOf: 3 })).toStrictEqual(plain);
    expect(setupOf({ ...plain, picks: [] })).toStrictEqual(plain);
    const blind = without('format', 'picks');
    expect(setupOf({ ...blind, format: 'blind', picks: [] })).toStrictEqual(blind);
  });

  it('refuses what is not a setup at all', () => {
    for (const raw of [null, undefined, 0, 'series', [], [valid], true]) {
      expect(reasonOf(raw)).toBe('The series is not an object');
    }
  });

  it('refuses a field it does not know', () => {
    expect(reasonOf({ ...valid, admin: true })).toBe('Unknown field "admin"');
  });

  it('refuses a ruleset or seed that is not a 32-bit unsigned integer', () => {
    for (const ruleset of ['14', -1, 1.5, 0x1_0000_0000, Number.NaN, null]) {
      expect(reasonOf({ ...valid, ruleset })).toBe('The ruleset is not a 32-bit unsigned integer');
    }
    expect(reasonOf(without('ruleset'))).toBe('The ruleset is not a 32-bit unsigned integer');
    for (const seed of ['7', -7, 7.5, 0x1_0000_0000]) {
      expect(reasonOf({ ...valid, seed })).toBe('The seed is not a 32-bit unsigned integer');
    }
  });

  it('refuses a length the game does not play', () => {
    for (const bestOf of [1, 4, 7, '3', null]) {
      expect(reasonOf({ ...valid, bestOf })).toBe('The series is not Best of 3 or Best of 5');
    }
  });

  it('refuses a lineup that is not that many different balls from the roster', () => {
    const reason = 'A lineup is not 3 different balls from the roster';
    for (const a of ['abc', null, ['archer', 'ghost'], ['archer', 'archer', 'ghost']]) {
      expect(reasonOf({ ...valid, a })).toBe(reason);
    }
    expect(reasonOf({ ...valid, b: ['archer', 'ghost', 'nobody'] })).toBe(reason);
    expect(reasonOf({ ...valid, b: ['archer', 'ghost', 3] })).toBe(reason);
    expect(reasonOf({ ...valid, a: Array.from({ length: 100_000 }, () => 'archer') })).toBe(reason);
    expect(reasonOf({ ...valid, bestOf: 5 })).toBe(
      'A lineup is not 5 different balls from the roster',
    );
  });

  it('refuses an unknown opponent kind, or a bot opponent that is not whole', () => {
    for (const opponent of [{ kind: 'banana' }, null, 'bot', [], {}]) {
      expect(reasonOf({ ...valid, opponent })).toBe('Unknown opponent kind');
    }
    expect(reasonOf(without('opponent'))).toBe('Unknown opponent kind');
    expect(reasonOf(botWith({ bot: 'nobody' }))).toBe('No bot "nobody"');
    expect(reasonOf(botWith({ bot: 3 }))).toBe('No bot "3"');
    expect(reasonOf(botWith({ lineupSeed: '7' }))).toBe('The lineup seed is not a 32-bit integer');
    expect(reasonOf(botWith({ x: 1 }))).toBe('Unknown opponent field "x"');
    expect(reasonOf({ ...valid, opponent: { kind: 'player', bot: randomBot.id } })).toBe(
      'Unknown opponent field "bot"',
    );
  });

  it('refuses an unknown format', () => {
    for (const format of ['weird', 'Showdown', '', 3, null]) {
      expect(reasonOf({ ...valid, format })).toBe('Unknown format');
    }
  });

  it('refuses picks that are not balls from the roster, or more than any series makes', () => {
    for (const picks of ['archer', [3], ['nobody'], null]) {
      expect(reasonOf({ ...valid, picks })).toBe('The picks are not balls from the roster');
    }
    // Best of 3: both sides pick in every round but the last, so 4 at most.
    expect(reasonOf({ ...valid, picks: Array.from({ length: 5 }, () => 'archer') })).toBe(
      'More picks than any series makes',
    );
  });

  it('never throws, whatever it is given', () => {
    const random = createStream(2026);
    const plain: unknown[] = [null, true, 0, -1, 0x100_0000_0000, '', 'archer', 'bot', [], {}];
    const any = (depth: number): unknown => {
      const roll = random();
      if (depth > 2 || roll < 0.5) return plain[Math.floor(random() * plain.length)];
      if (roll < 0.7) return Array.from({ length: Math.floor(random() * 4) }, () => any(depth + 1));
      return {
        kind: any(depth + 1),
        bot: any(depth + 1),
        lineupSeed: any(depth + 1),
        ...(roll < 0.85 ? {} : { rounds: any(depth + 1), toss: any(depth + 1) }),
      };
    };
    const keys = [...Object.keys(valid), 'bestOf', 'seeds'];
    for (let round = 0; round < 2000; round += 1) {
      const raw: Record<string, unknown> = { ...valid };
      for (const key of keys) if (random() < 0.3) raw[key] = any(0);
      expect(() => decodeSeriesSetup(raw, roster)).not.toThrow();
      expect(() => decodeSeriesSetup(any(0), roster)).not.toThrow();
    }
  });
});

describe('parseSeriesSetup', () => {
  it('reads JSON text, and refuses text that is not JSON without throwing', () => {
    expect(parseSeriesSetup(JSON.stringify(valid), roster)).toStrictEqual({
      ok: true,
      setup: valid,
    });
    for (const text of ['', '{', 'undefined', '{"seed": 1,}', "{'a': 1}"]) {
      expect(parseSeriesSetup(text, roster)).toStrictEqual({
        ok: false,
        reason: 'The series is not valid JSON',
      });
    }
  });
});
