// Focus rings for the keyboard only, after real taps at 390 x 844 (an iPhone) (ADR 0086, focus-rings-flow.ts).
import { describe, it } from 'vitest';
import { checkFocusRings } from './focus-rings-flow.ts';

describe('focus rings', () => {
  it('show after a key, never after a tap', async () => {
    await checkFocusRings();
  });
});
