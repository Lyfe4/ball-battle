import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND,
  formatSound,
  gainOf,
  loadSound,
  parseSound,
  saveSound,
  SOUND_STORAGE_KEY,
} from './sound-settings.ts';

describe('sound settings', () => {
  it('reads back what it saves', () => {
    const store = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    saveSound(storage, { on: false, volume: 0.35 });
    expect(store.get(SOUND_STORAGE_KEY)).toBe('off:0.35');
    expect(loadSound(storage)).toEqual({ on: false, volume: 0.35 });
  });

  it('is on at a moderate volume for a first visit, or when storage is odd or throws', () => {
    expect(parseSound(null)).toEqual(DEFAULT_SOUND);
    expect(parseSound('loud')).toEqual(DEFAULT_SOUND);
    expect(parseSound('on:7')).toEqual(DEFAULT_SOUND);
    const broken = () => {
      throw new Error('blocked');
    };
    expect(loadSound(broken)).toEqual(DEFAULT_SOUND);
    expect(() => {
      saveSound(broken, DEFAULT_SOUND);
    }).not.toThrow();
    expect(DEFAULT_SOUND.on).toBe(true);
  });

  it('hears the slider on a curve, and nothing when off', () => {
    expect(gainOf({ on: true, volume: 0.5 })).toBe(0.25);
    expect(gainOf({ on: true, volume: 1 })).toBe(1);
    expect(gainOf({ on: false, volume: 1 })).toBe(0);
    expect(formatSound({ on: true, volume: 1 })).toBe('on:1');
  });
});
