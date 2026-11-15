// Home by opponent (home-play-flow.ts, ADR 0055) at 1920 x 1080, the browsers-full project.
import { describe, it } from 'vitest';
import { runHomePlayFlow } from './home-play-flow.ts';

describe('Play remembers, each opponent card opens its setup', () => {
  it('reaches each setup, keeps its choices, goes Back as expected and has no dead ends', async () => {
    await runHomePlayFlow();
  }, 120_000);
});
