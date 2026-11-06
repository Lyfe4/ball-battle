import { describe, expect, it } from 'vitest';
import { BOT_LEVEL_STORAGE_KEY, loadBotLevel, parseBotLevel, saveBotLevel } from './bot-level.ts';

describe('the remembered bot level', () => {
  it('reads a level a player can choose, and the default for anything else', () => {
    expect(parseBotLevel('hard')).toBe('hard');
    expect(parseBotLevel(' Easy ')).toBe('easy');
    expect(parseBotLevel('random')).toBe('normal');
    expect(parseBotLevel(null)).toBe('normal');
  });

  it('loads and saves through storage, and treats storage that throws as the default', () => {
    const store = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    saveBotLevel(storage, 'hard');
    expect(store.get(BOT_LEVEL_STORAGE_KEY)).toBe('hard');
    expect(loadBotLevel(storage)).toBe('hard');
    const broken = (): Storage => {
      throw new Error('blocked');
    };
    expect(loadBotLevel(broken)).toBe('normal');
    expect(() => {
      saveBotLevel(broken, 'easy');
    }).not.toThrow();
  });
});
