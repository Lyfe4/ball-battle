import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { botFor } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { revealFirst, setupWithPicks, type Format, type SeriesSetup } from '../sim/series.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import {
  clearSeries,
  loadSeries,
  loadSetup,
  saveSeries,
  saveSetup,
  SERIES_SETUP_STORAGE_KEY,
  SERIES_STORAGE_KEY,
  type SaveStorage,
} from './series-save.ts';
import { beginSession, resolvePicks } from './series-session.ts';
import { pagePositions, seriesAgainst, SUDDEN_DEATH } from './series-save-support.ts';

function memory(): { storage: SaveStorage; store: Map<string, string> } {
  const store = new Map<string, string>();
  const storage: SaveStorage = () => ({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  });
  return { storage, store };
}

/** Saves `session`, then reads it back as a reload would. */
function reloaded(session: Parameters<typeof saveSeries>[1]) {
  const { storage } = memory();
  saveSeries(storage, session);
  return loadSeries(storage, BALL_LOOKUP);
}

/** A saved series' JSON, as far as the tampering below edits it. */
interface RawSave {
  save: number;
  setup: {
    ruleset: number;
    a: string[];
    b: string[];
    picks: string[];
    opponent: { bot: string };
  };
  plays: number | string;
  recorded: boolean;
  link?: string[];
}

/** Rewrites the saved series' JSON, as a tampered or broken save would be. */
function tampered(session: Parameters<typeof saveSeries>[1], edit: (saved: RawSave) => void) {
  const { storage, store } = memory();
  saveSeries(storage, session);
  const saved = JSON.parse(store.get(SERIES_STORAGE_KEY) ?? '') as RawSave;
  edit(saved);
  store.set(SERIES_STORAGE_KEY, JSON.stringify(saved));
  return { session: loadSeries(storage, BALL_LOOKUP), store };
}

describe('a saved series, reloaded', () => {
  const formats: readonly [Format, string][] = [
    ['blind', 'normal'],
    ['reveal', 'hard'],
    ['showdown', 'easy'],
  ];
  it.each(formats)(
    'comes back exactly where it was at every position (%s, %s bot)',
    (format, bot) => {
      const positions = pagePositions(seriesAgainst(format, bot, 4242));
      expect(positions.length).toBeGreaterThanOrEqual(4);
      for (const session of positions) expect(reloaded(session)).toStrictEqual(session);
    },
  );

  it('keeps a round’s draws and its sudden death', () => {
    const positions = pagePositions(SUDDEN_DEATH);
    const drawn = positions.filter((session) => session.state.pending.length > 0);
    const decidedByCoin = positions.filter((session) =>
      session.state.rounds.some((round) => round.suddenDeath),
    );
    expect(drawn.length).toBeGreaterThan(0);
    expect(decidedByCoin.length).toBeGreaterThan(0);
    for (const session of [...drawn, ...decidedByCoin]) {
      expect(reloaded(session)).toStrictEqual(session);
    }
  });

  it('carries on a replayed link where it was, still making the link’s picks', () => {
    const link = setupWithPicks(
      playLikeTheGame(seriesAgainst('reveal', 'normal', 99), BALL_LOOKUP),
    );
    const replay = resolvePicks(beginSession(link, true), botFor(link.opponent));
    for (const session of pagePositions(link, replay)) {
      expect(session.replay).toStrictEqual(link.picks);
      expect(reloaded(session)).toStrictEqual(session);
    }
  });

  it('is gone once cleared', () => {
    const { storage, store } = memory();
    saveSeries(storage, pagePositions(SUDDEN_DEATH)[0] ?? expect.fail('no position'));
    clearSeries(storage);
    expect(store.has(SERIES_STORAGE_KEY)).toBe(false);
    expect(loadSeries(storage, BALL_LOOKUP)).toBeUndefined();
  });
});

describe('a saved series that can’t be trusted is dropped', () => {
  // Round 2 of a Reveal series, its result on screen: both sides have picked.
  const positions = pagePositions(seriesAgainst('reveal', 'hard', 4242));
  const later = positions.find((s) => s.recorded && s.state.picks.length >= 3);
  if (later === undefined) throw new Error('Expected a recorded position with picks');

  it.each([
    ['from another ruleset', (s: RawSave) => (s.setup.ruleset = RULESET_VERSION - 1)],
    ['in another save shape', (s: RawSave) => (s.save = 2)],
    ['with a bot pick the bot never makes', (s: RawSave) => s.setup.picks.reverse()],
    ['with another bot lineup', (s: RawSave) => s.setup.b.reverse()],
    ['with an unknown bot', (s: RawSave) => (s.setup.opponent.bot = 'nobody')],
    ['with a ball not in the roster', (s: RawSave) => (s.setup.a[0] = 'dragon')],
    ['with a pick the series never reached', (s: RawSave) => s.setup.picks.push('frost')],
    ['past the end of the series', (s: RawSave) => (s.plays = 40)],
    [
      'with picks made after the position it names',
      (s: RawSave) => {
        s.plays = 0;
        s.recorded = false;
      },
    ],
    ['with a field of the wrong type', (s: RawSave) => (s.plays = '2')],
    ['as a link its picks don’t start', (s: RawSave) => (s.link = ['frost'])],
  ])('%s', (_, edit) => {
    const { session, store } = tampered(later, edit);
    expect(session).toBeUndefined();
    expect(store.has(SERIES_STORAGE_KEY)).toBe(false);
  });

  it('that isn’t JSON', () => {
    const { storage, store } = memory();
    store.set(SERIES_STORAGE_KEY, '{"save":1,');
    expect(loadSeries(storage, BALL_LOOKUP)).toBeUndefined();
    expect(store.has(SERIES_STORAGE_KEY)).toBe(false);
  });

  it('and storage that throws only means nothing is kept', () => {
    const storage: SaveStorage = () => {
      throw new Error('SecurityError');
    };
    expect(() => {
      saveSeries(storage, later);
    }).not.toThrow();
    expect(loadSeries(storage, BALL_LOOKUP)).toBeUndefined();
    expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({ draft: [] });
  });
});

describe('the saved setup', () => {
  const revealed: SeriesSetup = seriesAgainst('showdown', 'hard', 7);
  // A Reveal series whose coin toss the bot wins: it shows its ball before the player's pick.
  const seed = Array.from({ length: 50 }, (_, n) => n).find((n) => revealFirst(n) === 'b') ?? 0;
  const botFirst: SeriesSetup = seriesAgainst('reveal', 'normal', seed);

  it.each([
    ['Showdown', revealed],
    ['Reveal, the bot showing first', botFirst],
  ])(
    'keeps the lineup tray, gaps included, and the series revealed for round 1 (%s)',
    (_, series) => {
      const { storage } = memory();
      saveSetup(storage, { draft: ['storm', undefined, 'venom'], revealed: series });
      expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({
        draft: ['storm', undefined, 'venom'],
        revealed: series,
      });
    },
  );

  it.each([
    ['from another ruleset', { ...revealed, ruleset: RULESET_VERSION - 1 }],
    ['with picks already made', { ...revealed, picks: [revealed.a[0]] }],
    ['in Blind, which has no round-1 pick', { ...revealed, format: undefined }],
    ['with a lineup the bot never picks', { ...revealed, b: [...revealed.b].reverse() }],
  ])('drops a revealed series %s', (_, bad) => {
    const { storage } = memory();
    saveSetup(storage, { draft: ['storm'], revealed: bad as SeriesSetup });
    expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({ draft: ['storm'] });
  });

  it('reads a broken tray as empty', () => {
    const { storage, store } = memory();
    for (const draft of [['storm', 'storm'], ['dragon'], ['storm', null], 'storm', [1, 2]]) {
      store.set(SERIES_SETUP_STORAGE_KEY, JSON.stringify({ save: 1, draft }));
      expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({ draft: [] });
    }
  });
});
