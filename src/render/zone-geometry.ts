// Pure geometry for drawing zones and strikes; no canvas, so it can be unit tested.
import { createStream, deriveSeed } from '../sim/rng.ts';
import type { Vec2 } from '../sim/types.ts';
import { theme } from './theme.ts';

/**
 * A stable integer for a zone id: the number in "zone-<n>", or a string hash for anything else.
 * Ids come from the world's counter, so a replay gives every zone the same number.
 */
function idNumber(zoneId: string): number {
  const match = /^zone-(\d+)$/.exec(zoneId);
  if (match?.[1] !== undefined) return Number(match[1]);
  let hash = 0;
  for (let i = 0; i < zoneId.length; i++) hash = Math.imul(hash, 31) + zoneId.charCodeAt(i);
  return hash >>> 0;
}

/**
 * The jagged path of a lightning bolt from the top of the arena down to `target`, in world units.
 * Random-looking but derived only from the zone id, so a replay draws the same bolt (ADR 0006).
 * The renderer may use randomness; it just never uses Math.random here, so frames stay stable.
 */
export function boltPoints(zoneId: string, target: Vec2): readonly Vec2[] {
  const random = createStream(deriveSeed([idNumber(zoneId)]));
  const segments = theme.boltSegments;
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const along = i / segments;
    // Jitter shrinks to nothing at the end, so the bolt lands exactly on the target.
    const jitter = i === segments ? 0 : (random() * 2 - 1) * theme.boltJitter * (1 - along * 0.5);
    points.push({ x: target.x + jitter, y: target.y * along });
  }
  return points;
}

/** How far a zone is from striking: 0 when it appears, 1 on its strike tick. */
export function strikeProgress(
  zone: Readonly<{ spawnTick: number; strikeTick: number }>,
  tick: number,
): number {
  const span = zone.strikeTick - zone.spawnTick;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (tick - zone.spawnTick) / span));
}
