// Every matchup, in both slot orders, played twice for a whole match: the worlds and events must be
// identical (ADR 0001). Catches hidden state; a change that is deterministic but different is the
// ruleset fingerprint's job (ruleset.test.ts). One test per ball in slot A, so each has its own
// time budget as the roster grows, and a failure names the ball.
import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { ORDERED_PAIRS, play, ROSTER_TIMEOUT_MS } from './roster-support.ts';

const slotA = [...new Set(ORDERED_PAIRS.map(([a]) => a.id))];
/** Zone events seen in the compared matches, across every test in this file (run in order). */
const zoneEvents = new Set<string>();

describe('the ball roster (slow): determinism', () => {
  it.each(slotA)(
    'is deterministic for %s in slot A against every ball, worlds and events, zones included',
    { timeout: ROSTER_TIMEOUT_MS },
    (id) => {
      for (const [a, b] of ORDERED_PAIRS.filter(([first]) => first.id === id)) {
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
    },
  );

  it('compared zones too, and every ordered pair', () => {
    // Zones really are part of what was compared.
    expect([...zoneEvents].sort()).toStrictEqual(['zoneSpawned', 'zoneStruck']);
    expect(slotA.flatMap((id) => ORDERED_PAIRS.filter(([a]) => a.id === id))).toHaveLength(
      ORDERED_PAIRS.length,
    );
  });
});
