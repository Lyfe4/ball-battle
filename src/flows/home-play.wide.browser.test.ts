// The Play tab (home-play-flow.ts, ADR 0055, 0081) at 1280 x 800, the browsers-wide project.
import { describe, it } from 'vitest';
import { runHomePlayFlow } from './home-play-flow.ts';

describe('Play remembers, Change rules opens its setup', () => {
  it('reaches each setup, keeps its choices, goes Back as expected and has no dead ends', async () => {
    await runHomePlayFlow();
  }, 120_000);
});
