// The consistency flow (consistency-flow.ts, ADR 0038) at 1280 x 800, the browsers-wide project.
import { describe, it } from 'vitest';
import { runConsistencyFlow } from './consistency-flow.ts';

describe('every screen state looks and behaves the same', () => {
  it('legend always closable, Fight! centred, one How it was won', async () => {
    await runConsistencyFlow();
  }, 600_000);
});
