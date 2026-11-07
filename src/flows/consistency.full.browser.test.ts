// The consistency flow (consistency-flow.ts, ADR 0038) at 1920 x 1080, the browsers-full project, the size the legend bug was found at.
import { describe, it } from 'vitest';
import { runConsistencyFlow } from './consistency-flow.ts';

describe('every screen state looks and behaves the same', () => {
  it('legend always closable, Fight! centred, one How it was won', async () => {
    await runConsistencyFlow();
  }, 600_000);
});
