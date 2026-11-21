// Short moments on effect time (ADR 0007, 0060, 0075, 0077): a Slime splitting (from the sim's
// `split` event), a shot popping into a Balloon (a projectile hit its defence raised), a Jouster's
// lance landing head-on or glancing (a bump's `times`), and a Spider's web snapping when it catches
// a ball or a Mirage's copy popping (read from consecutive worlds, as wall bounces are, since a
// web's end and a copy are ability state, not events). Render-only: it reads the sim and
// never touches it.
import { copyPosition, mirageStateOf } from '../sim/balls/mirage.ts';
import { WEB_HALF_LENGTH, websOf, type Web } from '../sim/balls/spider.ts';
import type { SimEvent, Vec2, WorldState } from '../sim/types.ts';
import { theme } from './theme.ts';

/** A split being shown: the two halves, and how far through it is (0 to 1). */
export interface SplitMoment {
  readonly ballId: string;
  readonly newBallId: string;
  /** Where the two halves started. */
  readonly from: readonly [Vec2, Vec2];
  readonly progress: number;
}

/** A web snapping: which Spider's, where on which wall, and how far through it is (0 to 1). */
export interface SnapMoment {
  readonly ownerId: string;
  readonly web: Web;
  readonly progress: number;
}

/** A shot that hit harder for the ball's defence (the Balloon's pop): where it struck, 0 to 1. */
export interface PopMoment {
  readonly ballId: string;
  /** Where the shot's centre touched the ball. */
  readonly point: Vec2;
  readonly progress: number;
}

/** The shots this tick that a defence made hit harder, at the point each struck. */
export function poppedShots(events: readonly SimEvent[]): { ballId: string; point: Vec2 }[] {
  const pops: { ballId: string; point: Vec2 }[] = [];
  for (const event of events) {
    if (event.type !== 'damage' || event.via !== 'projectile' || (event.raised ?? 0) <= 0) continue;
    const hit = events.find(
      (other) => other.type === 'projectileHit' && other.targetId === event.targetId,
    );
    if (hit?.type === 'projectileHit') pops.push({ ballId: event.targetId, point: hit.point });
  }
  return pops;
}

/** A Mirage's copy popping: where it hung, how big it was, and how far through it is (0 to 1). */
export interface CopyPopMoment {
  readonly point: Vec2;
  readonly radius: number;
  readonly progress: number;
}

/** A Jouster's bump: where it landed, the way the lance was going, head-on or glancing, 0 to 1. */
export interface LanceMoment {
  readonly point: Vec2;
  /** Unit vector from the Jouster towards the ball it hit. */
  readonly way: Vec2;
  readonly headOn: boolean;
  readonly progress: number;
}

/** Copies that popped between two worlds, where each hung. */
export function poppedCopies(
  previous: WorldState,
  next: WorldState,
): { readonly point: Vec2; readonly radius: number }[] {
  const popped: { point: Vec2; radius: number }[] = [];
  for (const ball of next.balls) {
    const before = previous.balls.find((other) => other.id === ball.id);
    const then = before === undefined ? undefined : mirageStateOf(before);
    if (before === undefined || then?.copyOn !== true || mirageStateOf(ball)?.copyOn !== false) {
      continue;
    }
    popped.push({
      point: copyPosition(before.position, then, next.arena.size),
      radius: ball.radius,
    });
  }
  return popped;
}

/** The bumps this tick that a lance changed (`times`), with where each landed. */
export function lanceHits(events: readonly SimEvent[]): Omit<LanceMoment, 'progress'>[] {
  const hits: Omit<LanceMoment, 'progress'>[] = [];
  for (const event of events) {
    if (event.type !== 'damage' || event.times === undefined) continue;
    const { sourceId, targetId } = event;
    const contact = events.find(
      (other) =>
        other.type === 'collision' &&
        other.ballIds.includes(sourceId) &&
        other.ballIds.includes(targetId),
    );
    if (contact?.type !== 'collision') continue;
    // The normal points from the first ball to the second.
    const sign = contact.ballIds[0] === sourceId ? 1 : -1;
    const way = { x: contact.normal.x * sign, y: contact.normal.y * sign };
    hits.push({ point: contact.point, way, headOn: event.times > 1 });
  }
  return hits;
}

export interface Moments {
  apply(events: readonly SimEvent[], previous: WorldState, next: WorldState, nowMs: number): void;
  splits(nowMs: number): readonly SplitMoment[];
  snaps(nowMs: number): readonly SnapMoment[];
  pops(nowMs: number): readonly PopMoment[];
  copyPops(nowMs: number): readonly CopyPopMoment[];
  lances(nowMs: number): readonly LanceMoment[];
  isActive(nowMs: number): boolean;
  reset(): void;
}

/**
 * The webs a Spider lost this tick to a catch: webs gone before their time, on a tick it caught a
 * ball, and not respun in place (a web spun again on its own stretch moves, it doesn't snap).
 */
export function snappedWebs(
  previous: WorldState,
  next: WorldState,
): { readonly ownerId: string; readonly web: Web }[] {
  const snapped: { ownerId: string; web: Web }[] = [];
  for (const ball of next.balls) {
    const before = previous.balls.find((other) => other.id === ball.id);
    const now = websOf(ball);
    const then = before === undefined ? undefined : websOf(before);
    if (now === undefined || then === undefined || before === undefined) continue;
    const caughtNow = ball.abilityState['caught'] as Readonly<Record<string, number>>;
    const caughtThen = before.abilityState['caught'] as Readonly<Record<string, number>>;
    const caught = Object.keys(caughtNow).some((id) => caughtNow[id] !== caughtThen[id]);
    if (!caught) continue;
    for (const web of then) {
      const same = (other: Web) =>
        other.side === web.side && other.at === web.at && other.since === web.since;
      if (web.until <= next.tick || now.some(same)) continue;
      const respun = now.some(
        (other) =>
          other.side === web.side &&
          other.since > web.since &&
          Math.abs(other.at - web.at) < WEB_HALF_LENGTH,
      );
      if (!respun) snapped.push({ ownerId: ball.id, web });
    }
  }
  return snapped;
}

export function createMoments(): Moments {
  let splits: (Omit<SplitMoment, 'progress'> & { readonly startMs: number })[] = [];
  let snaps: (Omit<SnapMoment, 'progress'> & { readonly startMs: number })[] = [];
  let pops: (Omit<PopMoment, 'progress'> & { readonly startMs: number })[] = [];
  let copyPops: (Omit<CopyPopMoment, 'progress'> & { readonly startMs: number })[] = [];
  let lances: (Omit<LanceMoment, 'progress'> & { readonly startMs: number })[] = [];
  const progressOf = (startMs: number, nowMs: number, durationMs: number): number =>
    Math.max(0, (nowMs - startMs) / durationMs);
  const lanceMs = (headOn: boolean) => (headOn ? theme.lanceHitMs : theme.glanceSparkMs);
  return {
    apply(events, previous, next, nowMs) {
      for (const event of events) {
        if (event.type !== 'split') continue;
        const { ballId, newBallId, position, newPosition } = event;
        splits.push({ ballId, newBallId, from: [position, newPosition], startMs: nowMs });
      }
      for (const snap of snappedWebs(previous, next)) snaps.push({ ...snap, startMs: nowMs });
      for (const pop of poppedShots(events)) pops.push({ ...pop, startMs: nowMs });
      for (const pop of poppedCopies(previous, next)) copyPops.push({ ...pop, startMs: nowMs });
      for (const hit of lanceHits(events)) lances.push({ ...hit, startMs: nowMs });
    },
    splits(nowMs) {
      splits = splits.filter(({ startMs }) => progressOf(startMs, nowMs, theme.splitMs) < 1);
      return splits.map(({ startMs, ...split }) => ({
        ...split,
        progress: progressOf(startMs, nowMs, theme.splitMs),
      }));
    },
    snaps(nowMs) {
      snaps = snaps.filter(({ startMs }) => progressOf(startMs, nowMs, theme.webSnapMs) < 1);
      return snaps.map(({ startMs, ...snap }) => ({
        ...snap,
        progress: progressOf(startMs, nowMs, theme.webSnapMs),
      }));
    },
    pops(nowMs) {
      pops = pops.filter(({ startMs }) => progressOf(startMs, nowMs, theme.popMs) < 1);
      return pops.map(({ startMs, ...pop }) => ({
        ...pop,
        progress: progressOf(startMs, nowMs, theme.popMs),
      }));
    },
    copyPops(nowMs) {
      copyPops = copyPops.filter(({ startMs }) => progressOf(startMs, nowMs, theme.copyPopMs) < 1);
      return copyPops.map(({ startMs, ...pop }) => ({
        ...pop,
        progress: progressOf(startMs, nowMs, theme.copyPopMs),
      }));
    },
    lances(nowMs) {
      lances = lances.filter(
        ({ startMs, headOn }) => progressOf(startMs, nowMs, lanceMs(headOn)) < 1,
      );
      return lances.map(({ startMs, ...hit }) => ({
        ...hit,
        progress: progressOf(startMs, nowMs, lanceMs(hit.headOn)),
      }));
    },
    isActive(nowMs) {
      return (
        splits.some(({ startMs }) => progressOf(startMs, nowMs, theme.splitMs) < 1) ||
        snaps.some(({ startMs }) => progressOf(startMs, nowMs, theme.webSnapMs) < 1) ||
        pops.some(({ startMs }) => progressOf(startMs, nowMs, theme.popMs) < 1) ||
        copyPops.some(({ startMs }) => progressOf(startMs, nowMs, theme.copyPopMs) < 1) ||
        lances.some(({ startMs, headOn }) => progressOf(startMs, nowMs, lanceMs(headOn)) < 1)
      );
    },
    reset() {
      splits = [];
      snaps = [];
      pops = [];
      copyPops = [];
      lances = [];
    },
  };
}
