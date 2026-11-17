import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { slime } from '../sim/balls/slime.ts';
import { speedster } from '../sim/balls/speedster.ts';
import { spider, websOf } from '../sim/balls/spider.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { createMoments, snappedWebs } from './moments.ts';
import { theme } from './theme.ts';

/** Every tick of a whole match, with the world before it. */
function ticksOf(
  world: WorldState,
): { previous: WorldState; next: WorldState; events: SimEvent[] }[] {
  const ticks = [];
  let current = world;
  while (current.match.status === 'running') {
    const result = step(current, BALL_LOOKUP);
    ticks.push({ previous: current, next: result.world, events: [...result.events] });
    current = result.world;
  }
  return ticks;
}

describe('moments (ADR 0060)', () => {
  it('snaps a web exactly when it catches a ball, and never one that expired or moved', () => {
    const ticks = ticksOf(createWorld(3, [spider, speedster]));
    let snaps = 0;
    for (const { previous, next, events } of ticks) {
      const snapped = snappedWebs(previous, next);
      const slowed = events.some(
        (event) =>
          event.type === 'statusApplied' &&
          event.sourceId === 'ball-0' &&
          event.status === 'slowed',
      );
      // A web snaps on a catch (the slow is the catch), and only then.
      if (snapped.length > 0) expect(slowed).toBe(true);
      if (slowed) expect(snapped.length).toBeGreaterThan(0);
      const [owner] = next.balls;
      const now = owner === undefined ? [] : (websOf(owner) ?? []);
      for (const { web } of snapped) {
        expect(web.until).toBeGreaterThan(next.tick);
        expect(now.some((other) => other.since === web.since && other.at === web.at)).toBe(false);
      }
      snaps += snapped.length;
    }
    expect(snaps).toBeGreaterThan(0);
  });

  it('shows a split from its event, for splitMs', () => {
    const ticks = ticksOf(createWorld(29, [slime, getDefinition(BALL_LOOKUP, 'archer')]));
    const at = ticks.find(({ events }) => events.some((event) => event.type === 'split'));
    if (at === undefined) throw new Error('No split');
    const moments = createMoments();
    moments.apply(at.events, at.previous, at.next, 1000);
    expect(moments.splits(1000)).toMatchObject([
      { ballId: 'ball-0', newBallId: 'ball-0~1', progress: 0 },
    ]);
    expect(moments.isActive(1000 + theme.splitMs - 1)).toBe(true);
    expect(moments.splits(1000 + theme.splitMs)).toStrictEqual([]);
    expect(moments.isActive(1000 + theme.splitMs)).toBe(false);
  });
});
