// Every matchup, in both slot orders, played twice for a whole match: the worlds and events must be
// identical (ADR 0001). Catches hidden state; a change that is deterministic but different is the
// ruleset fingerprint's job (ruleset.test.ts).
import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { ORDERED_PAIRS, play, ROSTER_TIMEOUT_MS } from './roster-support.ts';

describe('the ball roster (slow): determinism', () => {
  it(
    'is deterministic for every matchup, worlds and events, zones included',
    { timeout: ROSTER_TIMEOUT_MS },
    () => {
      const zoneEvents = new Set<string>();
      for (const [a, b] of ORDERED_PAIRS) {
        const first = play(createWorld(99, [a, b]));
        const second = play(createWorld(99, [a, b]));
        expect(second.world).toStrictEqual(first.world);
        expect(second.events).toStrictEqual(first.events);
        for (const event of first.events) {
          if (event.type === 'zoneSpawned' || event.type === 'zoneStruck') {
            zoneEvents.add(event.type);
          }
        }
      }
      // Zones really are part of what was compared.
      expect([...zoneEvents].sort()).toStrictEqual(['zoneSpawned', 'zoneStruck']);
    },
  );
});
