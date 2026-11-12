import { describe, expect, it } from 'vitest';
import {
  loadSeriesLength,
  parseSeriesLength,
  saveSeriesLength,
  SERIES_LENGTH_STORAGE_KEY,
} from './series-length.ts';

describe('the remembered series length (ADR 0048)', () => {
  it('reads Best of 3 or 5, and Best of 3 for anything else', () => {
    expect(parseSeriesLength('5')).toBe(5);
    expect(parseSeriesLength(' 3 ')).toBe(3);
    expect(parseSeriesLength('7')).toBe(3);
    expect(parseSeriesLength('five')).toBe(3);
    expect(parseSeriesLength(null)).toBe(3);
  });

  it('loads and saves through storage, and treats storage that throws as Best of 3', () => {
    const store = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    expect(loadSeriesLength(storage)).toBe(3);
    saveSeriesLength(storage, 5);
    expect(store.get(SERIES_LENGTH_STORAGE_KEY)).toBe('5');
    expect(loadSeriesLength(storage)).toBe(5);
    const broken = (): Storage => {
      throw new Error('blocked');
    };
    expect(loadSeriesLength(broken)).toBe(3);
    expect(() => {
      saveSeriesLength(broken, 5);
    }).not.toThrow();
  });
});
