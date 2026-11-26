import { describe, expect, it } from 'vitest';
import { createToldEndings, MOST_TOLD } from './told-endings.ts';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('endings already told (ADR 0086)', () => {
  it('stay told after a reload of the page, the most recent MOST_TOLD', () => {
    const store = memory();
    const first = createToldEndings(() => store);
    first.add('s-1');
    expect(first.has('s-1')).toBe(true);
    // A reload: a new page reads what the session kept.
    expect(createToldEndings(() => store).has('s-1')).toBe(true);
    for (let n = 0; n < MOST_TOLD; n += 1) first.add(`x-${String(n)}`);
    expect(createToldEndings(() => store).has('s-1')).toBe(false);
    expect(createToldEndings(() => store).has(`x-${String(MOST_TOLD - 1)}`)).toBe(true);
  });

  it('keeps it in memory where storage refuses or holds nonsense', () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const told = createToldEndings(() => refusing);
    told.add('s-1');
    expect(told.has('s-1')).toBe(true);
    const odd = memory();
    odd.setItem('ballbattle.endingsTold', '{"no":1}');
    expect(createToldEndings(() => odd).has('no')).toBe(false);
  });
});
