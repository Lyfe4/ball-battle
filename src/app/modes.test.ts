import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { FORMATS } from '../sim/series.ts';
import { BOT_LEVEL_STORAGE_KEY } from './bot-level.ts';
import {
  botChooses,
  FIRST_PLAY,
  homeCardsFor,
  loadPlaySetup,
  PLAY_FORMAT_STORAGE_KEY,
  savePlaySetup,
  SETUP_FORMATS,
  writeBotSetupParams,
  writePlayParams,
} from './modes.ts';
import { parseRoute } from './route.ts';
import { SERIES_LENGTH_STORAGE_KEY } from './series-length.ts';

function memory(entries: Record<string, string> = {}) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    storage: () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    }),
  };
}

describe('home’s Play (ADR 0055)', () => {
  it('is Best of 3 · Reveal · vs Normal bot on a first visit', () => {
    expect(FIRST_PLAY).toStrictEqual({ format: 'reveal', bestOf: 3, level: 'normal' });
    expect(loadPlaySetup(memory().storage)).toStrictEqual(FIRST_PLAY);
  });

  it('remembers the last series set up against the bot: length, format and level', () => {
    const { storage, store } = memory();
    savePlaySetup(storage, { format: 'showdown', bestOf: 5, level: 'hard' });
    expect(store.get(PLAY_FORMAT_STORAGE_KEY)).toBe('showdown');
    expect(store.get(SERIES_LENGTH_STORAGE_KEY)).toBe('5');
    expect(store.get(BOT_LEVEL_STORAGE_KEY)).toBe('hard');
    expect(loadPlaySetup(storage)).toStrictEqual({ format: 'showdown', bestOf: 5, level: 'hard' });
  });

  it('reads anything it can’t use, or storage that throws, as a first visit', () => {
    const odd = memory({ [PLAY_FORMAT_STORAGE_KEY]: 'loser', [SERIES_LENGTH_STORAGE_KEY]: '7' });
    expect(loadPlaySetup(odd.storage)).toStrictEqual(FIRST_PLAY);
    const throws = () => {
      throw new Error('blocked');
    };
    expect(loadPlaySetup(throws)).toStrictEqual(FIRST_PLAY);
    expect(() => {
      savePlaySetup(throws, FIRST_PLAY);
    }).not.toThrow();
  });

  it('opens the remembered series’ lineup in one tap, with no setup step', () => {
    const params = new URLSearchParams('view=manual&ball=storm');
    writePlayParams(params, { format: 'reveal', bestOf: 5, level: 'hard' });
    expect(params.toString()).toBe('mode=bo5&fmt=reveal&step=lineup');
    expect(parseRoute(params, BALL_LOOKUP)).toMatchObject({
      screen: 'series',
      step: 'lineup',
      link: { format: 'reveal', bestOf: 5 },
    });
  });

  it('opens the vs Bot setup on a series link’s rules step, so old `?mode=bo3` links still do', () => {
    const params = new URLSearchParams('view=pick&a=storm&b=frost');
    writeBotSetupParams(params, 'showdown', 3);
    expect(params.toString()).toBe('mode=bo3&fmt=showdown');
    expect(parseRoute(params, BALL_LOOKUP)).toMatchObject({ screen: 'series', step: 'rules' });
  });
});

describe('home’s opponent cards (ADR 0055)', () => {
  it('offers vs Friend only where online play is built, the bot always', () => {
    expect(homeCardsFor(true)).toStrictEqual(['bot', 'friend']);
    expect(homeCardsFor(false)).toStrictEqual(['bot']);
  });

  it('offers every format against the bot, and only the live ones against a friend', () => {
    expect([...SETUP_FORMATS.bot].sort()).toStrictEqual([...FORMATS].sort());
    expect(SETUP_FORMATS.friend).toStrictEqual(['reveal', 'showdown']);
  });

  it('shows the bot’s level only where the bot makes choices', () => {
    expect(botChooses('reveal')).toBe(true);
    expect(botChooses('showdown')).toBe(true);
    expect(botChooses('blind')).toBe(false);
  });
});
