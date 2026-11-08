// Status effects (ADR 0009): plain data on the target ball, created only by actions, refreshed
// rather than stacked, removed at the start of the tick they expire on.
import type { BallState } from './types.ts';

/**
 * Every kind of status. An open union: a new kind is added here and in the code that reads it,
 * without touching balls that never apply it.
 * - slowed: cruise speed is reduced (ADR 0012).
 * - poisoned: takes small ability damage from its source on a fixed interval (ADR 0012).
 */
export type StatusKind = 'slowed' | 'poisoned';

/** A status on a ball. Plain serialisable data; a ball holds at most one of each kind. */
export interface StatusState {
  readonly kind: StatusKind;
  /** The ball that applied it most recently. */
  readonly sourceId: string;
  /** Removed at the start of this tick; active on every tick before it. */
  readonly expiresTick: number;
  /**
   * The tick it was first applied. A refresh keeps it, so anything on a fixed cadence (poison
   * ticks) runs from here and a refresh can neither reset nor speed up its rhythm.
   */
  readonly sinceTick: number;
}

/** Throws unless `durationTicks` is a whole number of at least 1; only a bug can produce one. */
export function assertStatusDuration(
  kind: StatusKind,
  durationTicks: number,
  sourceId: string,
): void {
  if (!Number.isInteger(durationTicks) || durationTicks < 1) {
    throw new Error(`"${sourceId}" tried to apply ${kind} for an invalid ${durationTicks} ticks`);
  }
}

/**
 * How long a status lasts on a ball that resists it (ADR 0016): the requested duration times the
 * share it keeps, rounded to whole ticks but never below 1. A share of 0 means immune, and returns
 * 0: the status is not applied at all. No share (undefined) is the full duration.
 */
export function resistedDuration(durationTicks: number, keeps: number | undefined): number {
  if (keeps === undefined) return durationTicks;
  if (!Number.isFinite(keeps) || keeps < 0 || keeps > 1) {
    throw new Error(`A status resistance must be a share from 0 to 1, got ${keeps}`);
  }
  return keeps === 0 ? 0 : Math.max(1, Math.round(durationTicks * keeps));
}

/** A status to apply, as carried by an action or a zone. */
export interface StatusRequest {
  readonly kind: StatusKind;
  /** Whole ticks, at least 1. */
  readonly durationTicks: number;
}

/** A status landed on a ball. `refreshed` when the ball already had that kind. */
export interface StatusAppliedEvent {
  readonly type: 'statusApplied';
  readonly tick: number;
  readonly ballId: string;
  readonly sourceId: string;
  readonly status: StatusKind;
  readonly expiresTick: number;
  readonly refreshed: boolean;
}

/** A status ran out, at the start of this tick. */
export interface StatusExpiredEvent {
  readonly type: 'statusExpired';
  readonly tick: number;
  readonly ballId: string;
  readonly status: StatusKind;
}

/** Share of its cruise speed a slowed ball loses (ADR 0012). The Frost's lever. */
export const SLOW_FACTOR = 0.3;

/** A slowed ball's cruise speed. */
export function slowedSpeed(speed: number): number {
  return speed * (1 - SLOW_FACTOR);
}

/** Ability damage each poison tick deals (ADR 0012). The Venom's lever. */
export const POISON_DAMAGE = 5;
/** Ticks between poison ticks, counted from when the poison was first applied. */
export const POISON_INTERVAL_TICKS = 34;

/** True when a poison first applied on `sinceTick` ticks on `tick`: every interval after it. */
export function isPoisonTick(sinceTick: number, tick: number): boolean {
  const elapsed = tick - sinceTick;
  return elapsed > 0 && elapsed % POISON_INTERVAL_TICKS === 0;
}

/** True if the ball has a status of this kind. Expired statuses are already removed by `step`. */
export function hasStatus(ball: BallState, kind: StatusKind): boolean {
  return ball.statuses.some((status) => status.kind === kind);
}

/**
 * The ball with `request` applied by `sourceId` on `tick`. A kind it already has is refreshed,
 * never stacked: its expiry becomes the later of the two, so a refresh never shortens it, and the
 * newest source is recorded; the tick it was first applied is kept. Throws for a duration that is not a whole number of at least 1.
 */
export function withStatus(
  ball: BallState,
  request: StatusRequest,
  sourceId: string,
  tick: number,
): { readonly ball: BallState; readonly event: StatusAppliedEvent } {
  const { kind, durationTicks } = request;
  assertStatusDuration(kind, durationTicks, sourceId);
  const existing = ball.statuses.find((status) => status.kind === kind);
  const expiresTick = Math.max(existing?.expiresTick ?? 0, tick + durationTicks);
  const sinceTick = existing?.sinceTick ?? tick;
  const status: StatusState = { kind, sourceId, expiresTick, sinceTick };
  return {
    ball: {
      ...ball,
      statuses: [...ball.statuses.filter((other) => other.kind !== kind), status],
    },
    event: {
      type: 'statusApplied',
      tick,
      ballId: ball.id,
      sourceId,
      status: kind,
      expiresTick,
      refreshed: existing !== undefined,
    },
  };
}

/** Removes every status whose expiry is `tick` or earlier, with one event per status removed. */
export function expireStatuses(
  balls: readonly BallState[],
  tick: number,
): { readonly balls: readonly BallState[]; readonly events: readonly StatusExpiredEvent[] } {
  const events: StatusExpiredEvent[] = [];
  const next = balls.map((ball) => {
    if (!ball.statuses.some((status) => status.expiresTick <= tick)) return ball;
    for (const status of ball.statuses) {
      if (status.expiresTick <= tick) {
        events.push({ type: 'statusExpired', tick, ballId: ball.id, status: status.kind });
      }
    }
    return { ...ball, statuses: ball.statuses.filter((status) => status.expiresTick > tick) };
  });
  return { balls: next, events };
}
