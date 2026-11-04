import { describe, expect, it } from 'vitest';
import { loadSpeed, parseSpeed, saveSpeed, scaleFrame, SPEED_STORAGE_KEY } from './speed.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const throwing = (): never => {
  throw new Error('SecurityError: storage is disabled');
};

describe('playback speed', () => {
  it('parses only the speeds it knows', () => {
    expect(parseSpeed('2')).toBe(2);
    expect(parseSpeed(' 1 ')).toBe(1);
    expect(parseSpeed('3')).toBe(1);
    expect(parseSpeed('2x')).toBe(1);
    expect(parseSpeed(null)).toBe(1);
    expect(parseSpeed(undefined)).toBe(1);
  });

  it('scales a frame of real time', () => {
    expect(scaleFrame(16, 1)).toBe(16);
    expect(scaleFrame(16, 2)).toBe(32);
  });

  it('remembers the speed in storage', () => {
    const storage = memoryStorage();
    expect(loadSpeed(() => storage)).toBe(1);
    saveSpeed(() => storage, 2);
    expect(storage.getItem(SPEED_STORAGE_KEY)).toBe('2');
    expect(loadSpeed(() => storage)).toBe(2);
  });

  it('falls back to normal speed when storage throws, and saving quietly does nothing', () => {
    expect(loadSpeed(throwing)).toBe(1);
    expect(loadSpeed(() => ({ getItem: throwing }))).toBe(1);
    expect(() => {
      saveSpeed(throwing, 2);
    }).not.toThrow();
    expect(() => {
      saveSpeed(() => ({ setItem: throwing }), 2);
    }).not.toThrow();
  });

  it('ignores a tampered stored value', () => {
    expect(loadSpeed(() => memoryStorage({ [SPEED_STORAGE_KEY]: '1000' }))).toBe(1);
  });
});
