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
  writePlayParams,
  FIRST_FRIEND,
  FRIEND_BEST_OF_STORAGE_KEY,
  FRIEND_FORMAT_STORAGE_KEY,
  loadPlayChoice,
  offeredFormat,
  PLAY_OPPONENT_STORAGE_KEY,
  savePlayChoice,
  FRIEND_TURNS_STORAGE_KEY,
  loadFriendSetup,
  saveFriendSetup,
  savePlayOpponent,
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
  it('is Best of 5 · Reveal · vs Normal bot with nothing chosen (ADR 0090 addendum)', () => {
    expect(FIRST_PLAY).toStrictEqual({ format: 'reveal', bestOf: 5, level: 'normal' });
    expect(loadPlaySetup(memory().storage)).toStrictEqual(FIRST_PLAY);
  });

  it('keeps a length the player chose: Best of 3 stays Best of 3', () => {
    const chosen = memory({ [SERIES_LENGTH_STORAGE_KEY]: '3' });
    expect(loadPlaySetup(chosen.storage).bestOf).toBe(3);
    expect(loadFriendSetup(memory({ [FRIEND_BEST_OF_STORAGE_KEY]: '3' }).storage).bestOf).toBe(3);
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

describe('what the Play tab’s box starts (ADR 0081, Option B)', () => {
  it('offers vs Friend only where online play is built, the bot always and first', () => {
    expect(playChoicesFor(true)).toStrictEqual(['bot', 'friend']);
    expect(playChoicesFor(false)).toStrictEqual(['bot']);
  });

  it('is the bot on a first visit, and a live Best of 5 · Reveal for a friend', () => {
    expect(FIRST_FRIEND).toStrictEqual({ format: 'reveal', bestOf: 5, turns: false });
    expect(loadPlayChoice(memory().storage, ['bot', 'friend'])).toStrictEqual({
      opponent: 'bot',
      bot: FIRST_PLAY,
      friend: FIRST_FRIEND,
    });
  });

  it('remembers each opponent’s rules, and who was chosen last', () => {
    const { storage, store } = memory();
    savePlayChoice(storage, {
      opponent: 'friend',
      bot: { format: 'blind', bestOf: 5, level: 'hard' },
      friend: { format: 'showdown', bestOf: 5, turns: false },
    });
    expect(store.get(PLAY_OPPONENT_STORAGE_KEY)).toBe('friend');
    expect(store.get(FRIEND_FORMAT_STORAGE_KEY)).toBe('showdown');
    expect(store.get(FRIEND_BEST_OF_STORAGE_KEY)).toBe('5');
    // The bot's are Play's own, shared with the setup and the lineup's level (ADR 0055).
    expect(store.get(PLAY_FORMAT_STORAGE_KEY)).toBe('blind');
    expect(loadPlayChoice(storage, ['bot', 'friend'])).toStrictEqual({
      opponent: 'friend',
      bot: { format: 'blind', bestOf: 5, level: 'hard' },
      friend: { format: 'showdown', bestOf: 5, turns: false },
    });
  });

  it('remembers Live or By turns for a friend, by turns only where the build plays by turns', () => {
    const { storage, store } = memory();
    saveFriendSetup(storage, { format: 'reveal', bestOf: 3, turns: true });
    expect(store.get(FRIEND_TURNS_STORAGE_KEY)).toBe('true');
    expect(loadFriendSetup(storage, true).turns).toBe(true);
    // A build without play by turns plays live, whatever this device remembers.
    expect(loadFriendSetup(storage, false).turns).toBe(false);
    savePlayOpponent(storage, 'friend');
    expect(store.get(PLAY_OPPONENT_STORAGE_KEY)).toBe('friend');
  });

  it('falls back to the bot where the build has no friend, and to a live format for a friend', () => {
    const { storage } = memory({
      [PLAY_OPPONENT_STORAGE_KEY]: 'friend',
      [FRIEND_FORMAT_STORAGE_KEY]: 'blind',
      [FRIEND_BEST_OF_STORAGE_KEY]: '7',
    });
    expect(loadPlayChoice(storage, ['bot']).opponent).toBe('bot');
    expect(loadPlayChoice(storage, ['bot', 'friend']).friend).toStrictEqual(FIRST_FRIEND);
    const throws = () => {
      throw new Error('blocked');
    };
    expect(loadPlayChoice(throws, ['bot', 'friend'])).toStrictEqual({
      opponent: 'bot',
      bot: FIRST_PLAY,
      friend: FIRST_FRIEND,
    });
    expect(() => {
      savePlayChoice(throws, loadPlayChoice(throws, ['bot']));
    }).not.toThrow();
  });

  it('offers the formats in one order everywhere: Reveal, Showdown, Blind', () => {
    expect(SETUP_FORMATS.bot).toStrictEqual(['reveal', 'showdown', 'blind']);
    expect(SETUP_FORMATS.friend).toStrictEqual(['reveal', 'showdown']);
    expect([...SETUP_FORMATS.bot].sort()).toStrictEqual([...FORMATS].sort());
  });

  it('keeps a format an opponent offers, else its first', () => {
    expect(offeredFormat(SETUP_FORMATS.friend, 'showdown')).toBe('showdown');
    expect(offeredFormat(SETUP_FORMATS.friend, 'blind')).toBe('reveal');
  });

  it('shows the bot’s level only where the bot makes choices', () => {
    expect(botChooses('reveal')).toBe(true);
    expect(botChooses('showdown')).toBe(true);
    expect(botChooses('blind')).toBe(false);
  });
});
