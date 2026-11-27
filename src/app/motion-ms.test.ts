import { describe, expect, it } from 'vitest';
import { msOf } from './motion-ms.ts';

describe('msOf', () => {
  it('reads milliseconds and seconds', () => {
    expect(msOf('160ms', 0)).toBe(160);
    expect(msOf(' 0.25s ', 0)).toBe(250);
  });

  it('gives the fallback, never NaN, for a missing or odd token', () => {
    for (const value of ['', 'auto', 'var(--x)', '12']) expect(msOf(value, 200), value).toBe(200);
  });
});
