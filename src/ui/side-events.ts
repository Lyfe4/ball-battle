// A match's events told by side (ADR 0059): what a Slime's half did is credited to its side's
// first ball, so a story names one ball a side however many it split into.
import { sideOfId } from '../sim/side.ts';
import type { BallState, SimEvent } from '../sim/types.ts';

/** `events` with every damage source, damage target and healed ball read as its side. */
export function sideEvents(events: readonly SimEvent[], balls: readonly BallState[]): SimEvent[] {
  return events.map((event) => {
    if (event.type === 'damage') {
      return {
        ...event,
        sourceId: sideOfId(balls, event.sourceId),
        targetId: sideOfId(balls, event.targetId),
      };
    }
    if (event.type === 'healed') return { ...event, ballId: sideOfId(balls, event.ballId) };
    return event;
  });
}
