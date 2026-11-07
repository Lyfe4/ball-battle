// Zones that can be set off (ADR 0043), the Bomber's bombs: once armed, the first solid enemy ball
// to touch the bomb's body makes it strike at once. Swept on each ball's motion over the tick, like
// projectiles (ADR 0005), so no speed can skip over a bomb.
import { isAlive, isPhased } from '../combat.ts';
import { getDefinition } from '../definitions.ts';
import { sweepHitTime } from '../projectiles/sweep.ts';
import type { BallState, DefinitionLookup, Vec2, ZoneState } from '../types.ts';

/** True when a body moving from `start` to `now` touched a still circle at `centre`. */
function touched(centre: Vec2, start: Vec2, now: Vec2, reach: number): boolean {
  return (
    sweepHitTime(
      { x: start.x - centre.x, y: start.y - centre.y },
      { x: now.x - start.x, y: now.y - start.y },
      reach,
    ) !== undefined
  );
}

/**
 * Who sets `zone` off on `tick`, or undefined: the first live, solid enemy ball (in ball order)
 * whose path this tick touched its trigger circle. Only an armed zone that hasn't struck can be set
 * off. Minions pass over it (a skull is no weight), and so does a phased ball, which passes through
 * balls and skulls alike: setting one off is a touch (ADR 0026, 0028). Its strike still catches
 * both.
 */
export function triggeredBy(
  zone: ZoneState,
  tick: number,
  balls: readonly BallState[],
  startPositions: ReadonlyMap<string, Vec2>,
  definitions: DefinitionLookup,
): string | undefined {
  const { trigger } = zone;
  if (trigger === undefined || tick < trigger.armTick || tick >= zone.strikeTick) return undefined;
  for (const ball of balls) {
    if (ball.id === zone.ownerId || !isAlive(ball)) continue;
    if (isPhased(ball, getDefinition(definitions, ball.definitionId))) continue;
    const start = startPositions.get(ball.id) ?? ball.position;
    if (touched(zone.position, start, ball.position, trigger.radius + ball.radius)) return ball.id;
  }
  return undefined;
}
