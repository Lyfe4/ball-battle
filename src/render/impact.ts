// Pure readings of one tick's events for battle feel (ADR 0007): how hard each ball was hit, what
// the presentation clock should do, and which balls bounced off a wall. No canvas, no state.
import { DT } from '../sim/constants.ts';
import type { SimEvent, Vec2, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** All the damage one ball took in one tick, and where it was hit if the events say so. */
export interface Impact {
  readonly targetId: string;
  readonly damage: number;
  /** Contact point or arrow hit point; undefined for a zone strike. */
  readonly point: Vec2 | undefined;
  /** Unit vector the hit pushed along, for contact hits; undefined otherwise. */
  readonly normal: Vec2 | undefined;
}

export interface WallBounce {
  readonly ballId: string;
  /** Unit vector pointing out of the wall the ball bounced off. */
  readonly normal: Vec2;
}

/** What a tick asks of the presentation clock. Matches the frame driver's TickFeel. */
export interface Feel {
  readonly hitStopMs: number;
  readonly slowMo?: { readonly ms: number; readonly scale: number };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Impact strength from 0 to 1, where theme.fullImpactDamage is full strength. */
export function impactStrength(damage: number): number {
  return clamp01(damage / theme.fullImpactDamage);
}

/** Damage per ball for one tick, summed, in the order each ball was first hit. */
export function impactsOf(events: readonly SimEvent[]): readonly Impact[] {
  const impacts = new Map<
    string,
    { damage: number; point?: Vec2 | undefined; normal?: Vec2 | undefined }
  >();
  const contacts = new Map<string, { point: Vec2; normal: Vec2 }>();
  const arrows = new Map<string, Vec2>();
  for (const event of events) {
    if (event.type === 'collision') {
      const [a, b] = event.ballIds;
      const { x, y } = event.normal;
      // The first ball is pushed back against the normal, the second along it.
      contacts.set(a, { point: event.point, normal: { x: 0 - x, y: 0 - y } });
      contacts.set(b, { point: event.point, normal: event.normal });
    }
    if (event.type === 'projectileHit') arrows.set(event.targetId, event.point);
    if (event.type !== 'damage' || event.amount <= 0) continue;
    const entry = impacts.get(event.targetId) ?? { damage: 0 };
    entry.damage += event.amount;
    const contact = event.cause === 'contact' ? contacts.get(event.targetId) : undefined;
    entry.point ??= contact?.point ?? arrows.get(event.targetId);
    entry.normal ??= contact?.normal;
    impacts.set(event.targetId, entry);
  }
  return [...impacts].map(([targetId, { damage, point, normal }]) => ({
    targetId,
    damage,
    point,
    normal,
  }));
}

const knockout = (events: readonly SimEvent[]): boolean =>
  events.some((event) => event.type === 'ballDefeated');

/**
 * Hit-stop for a heavy hit (longer for a harder one), a longer one for a knockout, and slow-mo
 * when the match ends by knockout. Reduced motion keeps the brief hit-stops (a pause is not
 * movement) but drops the slow-mo.
 */
export function feelOf(events: readonly SimEvent[], reducedMotion: boolean): Feel {
  const ended = events.find((event) => event.type === 'matchEnded');
  const slowMo =
    !reducedMotion && ended?.reason === 'knockout'
      ? { ms: theme.knockoutSlowMoRealMs, scale: theme.knockoutSlowMoScale }
      : undefined;
  let hitStopMs = 0;
  if (knockout(events)) {
    hitStopMs = theme.knockoutHitStopMs;
  } else {
    const heaviest = Math.max(0, ...impactsOf(events).map((impact) => impact.damage));
    if (heaviest >= theme.heavyHitDamage) {
      const over =
        (heaviest - theme.heavyHitDamage) / (theme.fullImpactDamage - theme.heavyHitDamage);
      hitStopMs = theme.hitStopMinMs + (theme.hitStopMaxMs - theme.hitStopMinMs) * clamp01(over);
    }
  }
  return slowMo === undefined ? { hitStopMs } : { hitStopMs, slowMo };
}

/** Screen shake amplitude for a tick, in world units: knockouts only. */
export function shakeOf(events: readonly SimEvent[]): number {
  return knockout(events) ? theme.shakeKnockoutOffset : 0;
}

/**
 * Balls that bounced off a wall between two consecutive worlds: a velocity component flipped sign
 * while the ball was within one tick's travel of that wall. Read from the worlds, since the sim
 * reports wall hits only to abilities.
 */
export function wallBounces(previous: WorldState, next: WorldState): readonly WallBounce[] {
  const size = next.arena.size;
  const bounces: WallBounce[] = [];
  next.balls.forEach((ball, index) => {
    const before = previous.balls[index];
    if (before === undefined || ball.health <= 0) return;
    const reach = Math.hypot(before.velocity.x, before.velocity.y) * DT + 1;
    const { x, y } = ball.position;
    const r = ball.radius;
    if (before.velocity.x < 0 && ball.velocity.x > 0 && x - r <= reach) {
      bounces.push({ ballId: ball.id, normal: { x: 1, y: 0 } });
    } else if (before.velocity.x > 0 && ball.velocity.x < 0 && size - x - r <= reach) {
      bounces.push({ ballId: ball.id, normal: { x: -1, y: 0 } });
    }
    if (before.velocity.y < 0 && ball.velocity.y > 0 && y - r <= reach) {
      bounces.push({ ballId: ball.id, normal: { x: 0, y: 1 } });
    } else if (before.velocity.y > 0 && ball.velocity.y < 0 && size - y - r <= reach) {
      bounces.push({ ballId: ball.id, normal: { x: 0, y: -1 } });
    }
  });
  return bounces;
}
