// Never waiting without feedback at 390 x 664, every call slow and failing (slow-walk-flow.ts): what
// a screen knew stays, else its failure card with Try again; never a blank area or a skeleton left.
import { describe, it } from 'vitest';
import { walkSlowly } from './slow-walk-flow.ts';

describe('every screen with a slow server that fails', () => {
  it(
    'says so with Try again, never blank, never an endless skeleton',
    { timeout: 300_000 },
    async () => {
      await walkSlowly(true);
    },
  );
});
