import { describe, expect, it } from 'vitest';
import {
  loadSeriesLength,
  NEW_SERIES_BEST_OF,
  parseSeriesLength,
  saveSeriesLength,
  SERIES_LENGTH_STORAGE_KEY,
} from './series-length.ts';

describe('the remembered series length (ADR 0048, ADR 0090 addendum)', () => {
  it('reads Best of 3 or 5, and a new series’ Best of 5 for anything else', () => {
    expect(NEW_SERIES_BEST_OF).toBe(5);
    expect(parseSeriesLength('5')).toBe(5);
    expect(parseSeriesLength(' 3 ')).toBe(3);
    expect(parseSeriesLength('7')).toBe(5);
    expect(parseSeriesLength('five')).toBe(5);
    expect(parseSeriesLength(null)).toBe(5);
  });

  it('keeps a chosen Best of 3, and treats nothing chosen or storage that throws as Best of 5', () => {
    const store = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    expect(loadSeriesLength(storage)).toBe(5);
    saveSeriesLength(storage, 3);
    expect(store.get(SERIES_LENGTH_STORAGE_KEY)).toBe('3');
    // A remembered choice is never overwritten by the new default.
    expect(loadSeriesLength(storage)).toBe(3);
    saveSeriesLength(storage, 5);
    expect(loadSeriesLength(storage)).toBe(5);
    const broken = (): Storage => {
      throw new Error('blocked');
    };
    expect(loadSeriesLength(broken)).toBe(5);
    expect(() => {
      saveSeriesLength(broken, 5);
    }).not.toThrow();
  });
});
