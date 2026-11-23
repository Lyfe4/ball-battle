import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { FORMATS } from '../sim/series.ts';
import { BOT_LEVEL_STORAGE_KEY } from './bot-level.ts';
import {
  botChooses,
  FIRST_PLAY,
  playChoicesFor,
  loadPlaySetup,
  PLAY_FORMAT_STORAGE_KEY,
  savePlaySetup,
  SETUP_FORMATS,
  writeBotSetupParams,
  writeChangeRulesParams,
  writeOpponentPlayParams,
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

describe('the Play tab’s chooser (ADR 0055, 0081)', () => {
  it('offers vs Friend only where online play is built, the bot always and first', () => {
    expect(playChoicesFor(true)).toStrictEqual(['bot', 'friend']);
    expect(playChoicesFor(false)).toStrictEqual(['bot']);
  });

  it('plays the remembered bot series against the bot, and opens the send screen for a friend', () => {
    const setup = { format: 'showdown', bestOf: 5, level: 'hard' } as const;
    const bot = new URLSearchParams('view=manual');
    writeOpponentPlayParams(bot, 'bot', setup);
    expect(bot.toString()).toBe('mode=bo5&fmt=showdown&step=lineup');
    // A friend match needs a link: Play never remembers one (ADR 0055).
    const friend = new URLSearchParams('view=manual');
    writeOpponentPlayParams(friend, 'friend', setup);
    expect(friend.toString()).toBe('view=send&fmt=reveal&mode=bo3');
  });

  it('changes the rules on the chosen opponent’s setup, the bot’s on Play’s choices', () => {
    const setup = { format: 'blind', bestOf: 5, level: 'easy' } as const;
    const bot = new URLSearchParams();
    writeChangeRulesParams(bot, 'bot', setup);
    expect(bot.toString()).toBe('mode=bo5'); // No format is Blind.
    expect(parseRoute(bot, BALL_LOOKUP)).toMatchObject({ screen: 'series', step: 'rules' });
    const friend = new URLSearchParams();
    writeChangeRulesParams(friend, 'friend', setup);
    expect(friend.toString()).toBe('view=send&fmt=reveal&mode=bo3');
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
