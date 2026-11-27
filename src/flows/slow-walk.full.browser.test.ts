// Never waiting without feedback at 1920 x 1080 (ADR 0038), the API slowed to 1.5 s a call
// (slow-walk-flow.ts): every screen and online state, cold and warm.
import { describe, it } from 'vitest';
import { walkSlowly } from './slow-walk-flow.ts';

describe('every screen with a slow server, on a desktop', () => {
  it(
    'shows its content or its skeleton at once, never shifts, never waits blank',
    { timeout: 300_000 },
    async () => {
      await walkSlowly(false);
    },
  );
});
