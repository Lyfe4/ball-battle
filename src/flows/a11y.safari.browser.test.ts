// Accessibility at 390 x 664, signed in (a11y-flow.ts): no serious or critical axe finding on
// any screen, sheet, the settings menu or any online state.
import { describe, expect, it } from 'vitest';
import { linesOf, serious, walkA11y } from './a11y-flow.ts';

describe('accessibility, signed in', () => {
  it(
    'has no serious or critical finding anywhere the flows reach',
    { timeout: 120_000 },
    async () => {
      const all = await walkA11y(true);
      // Moderate and minor findings are listed with a failure; none were left on 2026-11-27.
      expect(serious(all), linesOf(all)).toStrictEqual([]);
    },
  );
});
