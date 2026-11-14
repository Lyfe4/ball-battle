// A Best of 5 survives a reload (ADR 0042, 0048) exactly as a Best of 3 does, a save from before
// Best of 5 still restores as a Best of 3, and a save whose length was changed is dropped.
import { describe, expect, it } from 'vitest';
import { WHOLE_RUN_TIMEOUT_MS } from '../sim/test-support.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import type { Format } from '../sim/series.ts';
import {
  loadSeries,
  loadSetup,
  saveSeries,
  saveSetup,
  SERIES_SETUP_STORAGE_KEY,
  SERIES_STORAGE_KEY,
  type SaveStorage,
} from './series-save.ts';
import type { SeriesSession } from './series-session.ts';
import { pagePositions, seriesAgainst } from './series-save-support.ts';

const FIVE = ['frost', 'thorns', 'sniper', 'storm', 'ghost'];

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

/** Saves `session`, lets `edit` change its JSON, then reads it back as a reload would. */
function reloaded(
  session: SeriesSession,
  edit?: (saved: { setup: Record<string, unknown> }) => void,
) {
  const { storage, store } = memory();
  saveSeries(storage, session);
  if (edit !== undefined) {
    const saved = JSON.parse(store.get(SERIES_STORAGE_KEY) ?? '') as {
      setup: Record<string, unknown>;
    };
    edit(saved);
    store.set(SERIES_STORAGE_KEY, JSON.stringify(saved));
  }
  return loadSeries(storage, BALL_LOOKUP);
}

describe('a saved Best of 5, reloaded', () => {
  const formats: readonly [Format, string][] = [
    ['blind', 'normal'],
    ['reveal', 'hard'],
    ['showdown', 'easy'],
  ];
  it.each(formats)(
    'comes back exactly where it was at every position (%s, %s bot)',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    (format, bot) => {
      const positions = pagePositions(seriesAgainst(format, bot, 4242, FIVE));
      expect(positions.at(-1)?.state.rounds.length).toBeGreaterThanOrEqual(3);
      for (const session of positions) expect(reloaded(session)).toStrictEqual(session);
    },
  );

  it('saves a Best of 3 with no length, as before, and reads a save without one as Best of 3', () => {
    const [three] = pagePositions(seriesAgainst('reveal', 'hard', 4242));
    if (three === undefined) throw new Error('no position');
    const { storage, store } = memory();
    saveSeries(storage, three);
    expect(store.get(SERIES_STORAGE_KEY)).not.toContain('bestOf');
    expect(loadSeries(storage, BALL_LOOKUP)).toStrictEqual(three);
  });

  it('drops a save whose length was changed', () => {
    const [, second] = pagePositions(seriesAgainst('reveal', 'hard', 4242, FIVE));
    if (second === undefined) throw new Error('no position');
    expect(reloaded(second, (saved) => (saved.setup['bestOf'] = 3))).toBeUndefined();
    expect(reloaded(second, (saved) => (saved.setup['bestOf'] = 4))).toBeUndefined();
    expect(reloaded(second, (saved) => delete saved.setup['bestOf'])).toBeUndefined();
  });

  it('keeps a five-ball tray and the Best of 5 revealed for round 1', () => {
    const { storage, store } = memory();
    const revealed = seriesAgainst('showdown', 'hard', 7, FIVE);
    const draft = ['storm', undefined, 'venom', 'ghost', 'quake'];
    saveSetup(storage, { draft, revealed });
    expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({ draft, revealed });
    // Six balls are more than any tray holds.
    const six = ['storm', 'frost', 'venom', 'ghost', 'quake', 'thorns'];
    store.set(SERIES_SETUP_STORAGE_KEY, JSON.stringify({ save: 1, draft: six }));
    expect(loadSetup(storage, BALL_LOOKUP)).toStrictEqual({ draft: [] });
  });
});
