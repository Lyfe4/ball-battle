// The Necromancer's minions, measured in play (ADR 0026): against every ball (the mirror too), in
// both slot orders, no Necromancer ever has more than MAX_MINIONS minions at once, and every minion
// either ends (pops, is destroyed or crumbles) or is still in play when the match does. Plays whole
// matches, so it lives in the slow suite.
import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { BALLS } from './index.ts';
import { MAX_MINIONS, necromancer } from './necromancer.ts';
import { play, ROSTER_TIMEOUT_MS } from './roster-support.ts';

describe('the ball roster (slow): minions', () => {
  it(
    `never lets a Necromancer have more than ${MAX_MINIONS} minion(s) at once`,
    { timeout: ROSTER_TIMEOUT_MS },
    () => {
      let most = 0;
      let spawned = 0;
      let accounted = 0;
      for (const opponent of BALLS) {
        for (let seed = 0; seed < 20; seed++) {
          const pair = seed % 2 === 0 ? [necromancer, opponent] : [opponent, necromancer];
          const { world, events } = play(createWorld(seed, pair), undefined, (current) => {
            for (const owner of ['ball-0', 'ball-1']) {
              const own = current.minions.filter((minion) => minion.ownerId === owner).length;
              most = Math.max(most, own);
            }
          });
          for (const event of events) {
            if (event.type === 'minionSpawned') spawned++;
            if (event.type === 'minionHit' || event.type === 'minionDestroyed') accounted++;
          }
          accounted += world.minions.length;
        }
      }
      expect(most).toBe(MAX_MINIONS);
      expect(spawned).toBeGreaterThan(0);
      expect(accounted).toBe(spawned);
    },
  );
});
