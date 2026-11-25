import { describe, expect, it } from 'vitest';
import { createVisitCache, type VisitKey } from './visit-cache.ts';

const LIST: VisitKey<readonly string[]> = { name: 'list' };
const ME: VisitKey<string> = { name: 'me' };

describe('the visit cache', () => {
  it('keeps what was read for the visit, by key', () => {
    const cache = createVisitCache();
    expect(cache.read(LIST)).toBeUndefined();
    cache.write(LIST, ['jo', 'sam']);
    cache.write(ME, 'sam');
    expect(cache.read(LIST)).toStrictEqual(['jo', 'sam']);
    expect(cache.read(ME)).toBe('sam');
  });

  it('forgets everything when who the player is changes, and counts the clears', () => {
    const cache = createVisitCache();
    cache.write(LIST, ['jo']);
    expect(cache.generation()).toBe(0);
    cache.clear();
    expect(cache.read(LIST)).toBeUndefined();
    expect(cache.generation()).toBe(1);
  });
});
