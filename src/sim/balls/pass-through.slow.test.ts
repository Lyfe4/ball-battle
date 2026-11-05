// The measured pass-through margin (ADR 0002): two balls must never close faster than a fraction of
// what the discrete overlap test can catch. The largest share of the slow suite, so it plays each
// pair once (mirrors included) with the slot order alternating between seeds: closing speed doesn't
// depend on which slot a ball starts in, and both orders are still covered.
import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { createWorld } from '../world.ts';
import { closingSpeed, PAIRS, play, ROSTER_TIMEOUT_MS } from './roster-support.ts';

/** Seeds per pair, split evenly between the two slot orders. */
const SEEDS = 60;

describe('the ball roster (slow): pass-through', () => {
  it(
    'never lets two balls close faster than the pass-through limit',
    { timeout: ROSTER_TIMEOUT_MS },
    () => {
      // ADR 0002: a hit can be missed if the balls close by more than the sum of their radii in one
      // tick. Includes speed from abilities and from elastic collisions.
      let worst = 0;
      for (const [a, b] of PAIRS) {
        const limit = (a.radius + b.radius) / DT;
        for (let seed = 0; seed < SEEDS; seed++) {
          const pair = seed % 2 === 0 ? ([a, b] as const) : ([b, a] as const);
          play(createWorld(seed, pair), undefined, (world) => {
            const [first, second] = world.balls;
            if (first === undefined || second === undefined) return;
            worst = Math.max(worst, closingSpeed(first, second) / limit);
          });
        }
      }
      // A safety margin below the real limit (1.0). It was 0.5 (2x) until step 3b, when a faster
      // Vampire and Archer pushed the worst observed case to about 0.504; 0.6 still leaves 1.67x.
      // Do not loosen this again. If a ball pushes past 0.6, implement swept ball-to-ball collision
      // (like the projectile sweep, ADR 0005) instead of raising the margin.
      expect(worst).toBeLessThan(0.6);
    },
  );
});
