// The arena tip flow (tips-arena-flow.ts, ADR 0036 addendum of 2026-11-23) at 390 x 664 (Safari's iPhone with its toolbars), the browsers-safari project.
import { describe, it } from 'vitest';
import { runTipsArenaFlow } from './tips-arena-flow.ts';

describe('a tip in the arena', () => {
  it('rings what it is about, tags it inside the court and captions it', async () => {
    await runTipsArenaFlow('under-speed');
  }, 120_000);
});
