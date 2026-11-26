// Accessibility at 390 x 664 as a guest (a11y-flow.ts): sign-in, a guest's Friends and Profile.
import { describe, expect, it } from 'vitest';
import { linesOf, serious, walkA11y } from './a11y-flow.ts';

describe('accessibility, as a guest', () => {
  it('has no serious or critical finding on any screen', { timeout: 120_000 }, async () => {
    const all = await walkA11y(false);
    // Moderate and minor findings are listed with a failure; none were left on 2026-11-27.
    expect(serious(all), linesOf(all)).toStrictEqual([]);
  });
});
