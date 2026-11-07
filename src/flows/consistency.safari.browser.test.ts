// The consistency flow (consistency-flow.ts, ADR 0038, 0044) at 390 x 664 with touch, the
// browsers-safari project: an iPhone in Safari with its toolbars shown, where settings opened
// mid-fight covered the court.
import { describe, it } from 'vitest';
import { runConsistencyFlow } from './consistency-flow.ts';

describe('every screen state looks and behaves the same', () => {
  it('legend always closable, Fight! centred, one How it was won, settings off the court', async () => {
    await runConsistencyFlow();
  }, 600_000);
});
