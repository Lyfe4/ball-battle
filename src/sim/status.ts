// Status effects (ADR 0009): plain data on the target ball, created only by actions, refreshed
// rather than stacked, removed at the start of the tick they expire on.
import type { BallState } from './types.ts';

/**
 * Every kind of status. An open union: a new kind ('slowed', 'poisoned') is added here and in the
 * code that reads it, without touching balls that never apply it.
 */
export type StatusKind = 'shocked';

/** A status on a ball. Plain serialisable data; a ball holds at most one of each kind. */
export interface StatusState {
  readonly kind: StatusKind;
  /** The ball that applied it most recently. */
  readonly sourceId: string;
  /** Removed at the start of this tick; active on every tick before it. */
  readonly expiresTick: number;
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

/** A heal that restored nothing because of a status. Takes the place of a `healed` event. */
export interface HealBlockedEvent {
  readonly type: 'healBlocked';
  readonly tick: number;
  readonly ballId: string;
  readonly sourceId: string;
  /** What the heal would have restored. */
  readonly amount: number;
  readonly status: StatusKind;
}

/**
 * Kinds compared as plain strings: while StatusKind has a single member, comparing two of them
 * directly is always true as far as the type checker knows.
 */
const sameKind = (a: string, b: string): boolean => a === b;

/** True if the ball has a status of this kind. Expired statuses are already removed by `step`. */
export function hasStatus(ball: BallState, kind: StatusKind): boolean {
  return ball.statuses.some((status) => sameKind(status.kind, kind));
}

/**
 * The ball with `request` applied by `sourceId` on `tick`. A kind it already has is refreshed,
 * never stacked: its expiry becomes the later of the two, so a refresh never shortens it, and the
 * newest source is recorded. Throws for a duration that is not a whole number of at least 1.
 */
export function withStatus(
  ball: BallState,
  request: StatusRequest,
  sourceId: string,
  tick: number,
): { readonly ball: BallState; readonly event: StatusAppliedEvent } {
  const { kind, durationTicks } = request;
  if (!Number.isInteger(durationTicks) || durationTicks < 1) {
    throw new Error(`"${sourceId}" tried to apply ${kind} for an invalid ${durationTicks} ticks`);
  }
  const existing = ball.statuses.find((status) => sameKind(status.kind, kind));
  const expiresTick = Math.max(existing?.expiresTick ?? 0, tick + durationTicks);
  const status: StatusState = { kind, sourceId, expiresTick };
  return {
    ball: {
      ...ball,
      statuses: [...ball.statuses.filter((other) => !sameKind(other.kind, kind)), status],
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
