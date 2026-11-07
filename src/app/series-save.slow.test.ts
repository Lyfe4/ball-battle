// Reload-safe series (ADR 0042), over many whole series: every position the page can be at, in
// every format and at every bot level, comes back exactly as it was after a save and a reload.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { ROSTER_TIMEOUT_MS } from '../sim/balls/roster-support.ts';
import { BOT_LEVELS } from '../sim/bot.ts';
import { FORMATS, type Format } from '../sim/series.ts';
import { loadSeries, saveSeries, type SaveStorage } from './series-save.ts';
import { pagePositions, seriesAgainst } from './series-save-support.ts';

const SEEDS = 12;

function memory(): SaveStorage {
  const store = new Map<string, string>();
  return () => ({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  });
}

describe('every saved position comes back exactly', () => {
  const cases = FORMATS.flatMap((format) =>
    (format === 'blind' ? BOT_LEVELS.slice(0, 1) : BOT_LEVELS).map((bot): [Format, string] => [
      format,
      bot.id,
    ]),
  );
  it.each(cases)('%s against the %s bot', { timeout: ROSTER_TIMEOUT_MS }, (format, bot) => {
    let positions = 0;
    for (let seed = 0; seed < SEEDS; seed += 1) {
      for (const session of pagePositions(seriesAgainst(format, bot, seed))) {
        const storage = memory();
        saveSeries(storage, session);
        expect(loadSeries(storage, BALL_LOOKUP)).toStrictEqual(session);
        positions += 1;
      }
    }
    expect(positions).toBeGreaterThan(SEEDS * 4);
  });
});
