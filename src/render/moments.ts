// Two short moments on effect time (ADR 0007, 0060): a Slime splitting (from the sim's `split`
// event) and a Spider's web snapping when it catches a ball (read from consecutive worlds, as wall
// bounces are, since a web's end is ability state, not an event). Render-only: it reads the sim and
// never touches it.
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

export interface Moments {
  apply(events: readonly SimEvent[], previous: WorldState, next: WorldState, nowMs: number): void;
  splits(nowMs: number): readonly SplitMoment[];
  snaps(nowMs: number): readonly SnapMoment[];
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
  const progressOf = (startMs: number, nowMs: number, durationMs: number): number =>
    Math.max(0, (nowMs - startMs) / durationMs);
  return {
    apply(events, previous, next, nowMs) {
      for (const event of events) {
        if (event.type !== 'split') continue;
        const { ballId, newBallId, position, newPosition } = event;
        splits.push({ ballId, newBallId, from: [position, newPosition], startMs: nowMs });
      }
      for (const snap of snappedWebs(previous, next)) snaps.push({ ...snap, startMs: nowMs });
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
    isActive(nowMs) {
      return (
        splits.some(({ startMs }) => progressOf(startMs, nowMs, theme.splitMs) < 1) ||
        snaps.some(({ startMs }) => progressOf(startMs, nowMs, theme.webSnapMs) < 1)
      );
    },
    reset() {
      splits = [];
      snaps = [];
    },
  };
}
