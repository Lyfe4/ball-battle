import { describe, expect, it } from 'vitest';
import { fontProblem } from './font-once.ts';

const LATIN = '/assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2';

describe('the font on a first visit, counted at the server', () => {
  it('is right when the preloaded file came once and nothing else did', () => {
    expect(fontProblem(new Map([[LATIN, 1]]))).toBeUndefined();
  });

  it('is wrong when it came twice (a preload the stylesheet could not use)', () => {
    expect(fontProblem(new Map([[LATIN, 2]]))).toBe(`{"${LATIN}":2}`);
  });

  it('is wrong when it never came, or another subset came too', () => {
    expect(fontProblem(new Map())).toBe('{}');
    const extra = '/assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2';
    expect(
      fontProblem(
        new Map([
          [LATIN, 1],
          [extra, 1],
        ]),
      ),
    ).toBeDefined();
  });
});
