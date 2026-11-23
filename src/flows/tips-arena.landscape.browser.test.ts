// The arena tip flow (tips-arena-flow.ts, ADR 0036 addendum of 2026-11-23) at 812 x 375 (a phone turned sideways), the browsers-landscape project.
import { describe, it } from 'vitest';
import { runTipsArenaFlow } from './tips-arena-flow.ts';

describe('a tip in the arena', () => {
  it('rings what it is about, tags it inside the court and captions it', async () => {
    await runTipsArenaFlow('in-panel');
  }, 120_000);
});
