// Every ball's own sounds in real fights (ADR 0064): over every pair of the roster, each ball's
// sounds are all heard in its matches, and a match makes only its two balls' sounds and the shared
// ones, never another ball's.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { PAIRS, ROSTER_TIMEOUT_MS } from '../sim/balls/roster-support.ts';
import { step } from '../sim/step.ts';
import { createWorld } from '../sim/world.ts';
import { BALL_SOUNDS, SHARED_SOUNDS } from './ball-sounds.ts';
import type { FightCue } from './cue-names.ts';
import { cuesOf } from './cues.ts';

const SEEDS = [1, 2, 3];

describe('every ball is heard as itself', () => {
  it(
    'makes all its own sounds in its matches, and only its own',
    () => {
      const heardBy = new Map<string, Set<FightCue>>();
      const strays: string[] = [];
      for (const [a, b] of PAIRS) {
        const allowed = new Set([
          ...SHARED_SOUNDS,
          ...(BALL_SOUNDS[a.id] ?? []),
          ...(BALL_SOUNDS[b.id] ?? []),
        ]);
        for (const seed of SEEDS) {
          let world = createWorld(seed, [a, b]);
          while (world.match.status === 'running') {
            const result = step(world, BALL_LOOKUP);
            for (const { kind } of cuesOf(result.events, world, result.world)) {
              if (!allowed.has(kind)) strays.push(`${a.id} vs ${b.id}: ${kind}`);
              // Credited to the ball whose sound it is (in a mirror, either).
              for (const ball of [a.id, b.id]) {
                if (BALL_SOUNDS[ball]?.includes(kind) === true) {
                  const heard = heardBy.get(ball) ?? new Set<FightCue>();
                  heard.add(kind);
                  heardBy.set(ball, heard);
                }
              }
            }
            world = result.world;
          }
        }
      }
      expect([...new Set(strays)]).toStrictEqual([]);
      const missing = Object.entries(BALL_SOUNDS).flatMap(([ball, sounds]) =>
        sounds
          .filter((kind) => heardBy.get(ball)?.has(kind) !== true)
          .map((kind) => `${ball}: ${kind}`),
      );
      expect(missing).toStrictEqual([]);
    },
    ROSTER_TIMEOUT_MS,
  );
});
