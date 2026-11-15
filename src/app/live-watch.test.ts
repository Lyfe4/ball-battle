// The server's watching time for a live fight (ADR 0053) against the page's own presentation: every
// known match (ADR 0023) played the way the arena plays it at 1×, frame by frame at 60 Hz, with its
// hit-stops and knockout slow-mo, from Fight! to the end of the winner's celebration. The next pick
// opens at the server's estimate on both screens, so the estimate must never be the shorter.
import { describe, expect, it } from 'vitest';
import { attemptWatchMs } from '../api/live.ts';
import { GOLDEN_CASES } from '../golden/golden.ts';
import { createEffects } from '../render/effects.ts';
import { feelOf } from '../render/impact.ts';
import { theme } from '../render/theme.ts';
import { createWorld, step } from '../sim/index.ts';
import type { WorldState } from '../sim/types.ts';
import { advanceFrame, startPlayback } from './playback.ts';

const FRAME_MS = 1000 / 60;

/** Real milliseconds the arena takes to show `world` from its intro to the celebration's end. */
function presentedMs(world: WorldState, reducedMotion: boolean): number {
  const effects = createEffects();
  effects.setReducedMotion(reducedMotion);
  let playback = startPlayback(world, theme.introMs);
  let realMs = 0;
  for (;;) {
    const outcome = advanceFrame(playback, FRAME_MS, step, ({ result }) =>
      feelOf(result.events, reducedMotion),
    );
    playback = outcome.playback;
    realMs += FRAME_MS;
    for (const { result } of outcome.ticks) effects.apply(result.events, playback.effectMs);
    if (playback.world.match.status !== 'running' && effects.celebrationOver(playback.effectMs)) {
      return realMs;
    }
    if (realMs > 10 * 60_000) throw new Error('A match never finished presenting');
  }
}

describe('a live fight’s watching time', () => {
  it('is never shorter than the page’s own presentation of any known match', () => {
    let tightest = Infinity;
    for (const golden of GOLDEN_CASES) {
      const world = createWorld(golden.seed, golden.a, golden.b);
      const shown = presentedMs(world, false);
      let end = world;
      while (end.match.status === 'running') end = step(end).world;
      const estimate = attemptWatchMs(end.tick);
      expect(estimate, `${golden.a} v ${golden.b}, seed ${String(golden.seed)}`).toBeGreaterThan(
        shown,
      );
      tightest = Math.min(tightest, estimate - shown);
    }
    // Generous, but not wildly: under 3 s spare on the closest match.
    expect(tightest).toBeLessThan(3_000);
  }, 120_000);
});
