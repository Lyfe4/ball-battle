// Home's one tap into Reveal and Other modes (home-modes-flow.ts, ADR 0046) at 375 x 812 with touch, the browsers-touch project.
import { describe, it } from 'vitest';
import { runHomeModesFlow } from './home-modes-flow.ts';

describe('Reveal one tap from home, every other mode behind Other modes', () => {
  it('reaches each mode, keeps the level, goes Back as expected and has no dead ends', async () => {
    await runHomeModesFlow();
  }, 120_000);
});
