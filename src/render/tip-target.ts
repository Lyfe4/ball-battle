// What an arena tip points at (ADR 0036 addendum of 2026-11-23), from the ball's declared `tipOn`
// and the sim event that first showed its ability, then each frame from the drawn world only (rule
// 4). Pure, so it is tested without a DOM. A zone's or a minion's tip has no spot once its zone has
// struck or ended or its minion is gone: the ring then fades where it was.
import { sideOf } from '../sim/side.ts';
import type {
  BallState,
  DefinitionLookup,
  SimEvent,
  TipOn,
  Vec2,
  WorldState,
} from '../sim/types.ts';

export type TipTarget =
  /** A ball: `key` is its definition id, so a Slime's surviving half can take over. */
  | { readonly kind: 'ball'; readonly ballId: string; readonly key: string }
  | { readonly kind: 'copy'; readonly ballId: string; readonly key: string }
  | { readonly kind: 'zone'; readonly zoneId: string }
  | { readonly kind: 'minion'; readonly minionId: string };

/** The tip's target for `event`, the moment `ball`'s ability (declared `tipOn`) first showed. */
export function tipTargetOf(
  tipOn: TipOn,
  event: SimEvent,
  ball: BallState,
  balls: readonly BallState[],
): TipTarget {
  const on = (target: BallState): TipTarget => ({
    kind: 'ball',
    ballId: target.id,
    key: target.definitionId,
  });
  const struck = (id: string): TipTarget => {
    const target = balls.find((candidate) => candidate.id === id);
    return on(target ?? ball);
  };
  switch (tipOn) {
    case 'zone':
      return event.type === 'zoneSpawned' ? { kind: 'zone', zoneId: event.zoneId } : on(ball);
    case 'minion':
      return event.type === 'minionSpawned'
        ? { kind: 'minion', minionId: event.minionId }
        : on(ball);
    case 'struck':
      if (event.type === 'statusApplied') return struck(event.ballId);
      if (event.type === 'damage') return struck(event.targetId);
      return on(ball);
    case 'copy':
      return { kind: 'copy', ballId: ball.id, key: ball.definitionId };
    case 'self':
      return on(ball);
  }
}

/**
 * The ball a target is about: its own ball while it is in the fight, else another of the same kind
 * on its side (a Slime's surviving half), else none.
 */
export function ballOf(
  ballId: string,
  key: string,
  balls: readonly BallState[],
): BallState | undefined {
  const own = balls.find((ball) => ball.id === ballId);
  if (own !== undefined && own.health > 0) return own;
  const side = own === undefined ? ballId : sideOf(own);
  return balls.find(
    (ball) => ball.health > 0 && ball.definitionId === key && sideOf(ball) === side,
  );
}

export interface TipSpot {
  readonly position: Vec2;
  readonly radius: number;
  /** The ball the ring is on, if it is on one. */
  readonly ballId?: string;
  /** What the ring is on: when it changes (the copy fades, a half takes over) the ring glides. */
  readonly key: string;
}

/** Where `target` is in `world`, or undefined once it has gone (the tip then fades). */
export function tipSpotOf(
  target: TipTarget,
  world: WorldState,
  lookup: DefinitionLookup,
): TipSpot | undefined {
  switch (target.kind) {
    case 'ball':
    case 'copy': {
      const ball = ballOf(target.ballId, target.key, world.balls);
      if (ball === undefined) return undefined;
      const copy =
        target.kind === 'copy'
          ? lookup.get(ball.definitionId)?.decoyOf?.(ball, world.arena.size)
          : undefined;
      return copy === undefined
        ? { position: ball.position, radius: ball.radius, ballId: ball.id, key: `ball:${ball.id}` }
        : { position: copy, radius: ball.radius, key: `copy:${ball.id}` };
    }
    case 'zone': {
      const zone = world.zones.find((candidate) => candidate.id === target.zoneId);
      return zone === undefined
        ? undefined
        : { position: zone.position, radius: zone.radius, key: 'zone' };
    }
    case 'minion': {
      const minion = world.minions.find((candidate) => candidate.id === target.minionId);
      return minion === undefined
        ? undefined
        : { position: minion.position, radius: minion.radius, key: 'minion' };
    }
  }
}
