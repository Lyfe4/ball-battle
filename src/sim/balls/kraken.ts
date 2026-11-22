import { STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import { HELD_SHARE } from '../status.ts';
import type { AbilityAction, BallState } from '../types.ts';

/** A spot on the court where tentacles will rise. */
export type Spot = Readonly<{ x: number; y: number }>;
import { percentOf, secondsOf } from './how-it-works.ts';

export type KrakenState = Readonly<{
  /** The tick it next calls its tentacles (the ripples start), once it holds nothing. */
  nextGrabTick: number;
  /** The tick the tentacles burst up, while the ripples show; -1 otherwise. */
  burstTick: number;
  /** Where they burst: one spot per enemy ball, where it was heading when they were called. */
  spots: readonly Spot[];
  /** Each ball wrapped now, by id, and the tick its tentacles crush it. */
  holds: Readonly<Record<string, number>>;
}>;

/** Its first call, 1.5 s in. */
export const FIRST_GRAB_TICK = 90;
/** Ticks from one burst to the next call. */
export const GRAB_EVERY_TICKS = 200;
/** The ripples' warning before the tentacles burst up. */
export const RIPPLE_TICKS = 30;
/** How far from its spot a ball is still caught, beyond its own radius. */
export const GRAB_REACH = 90;
/** How long a wrapped ball is held before the crush. */
export const HOLD_TICKS = 90;
/** The crush, per tentacle. */
export const CRUSH_PER_TENTACLE = 6;
/** Tentacles a standard ball gets; a ball's count goes with its width, never fewer than this. */
export const STANDARD_TENTACLES = 2;
/** The Kraken's own speed while it holds a ball, as a share: it anchors to squeeze. */
export const ANCHOR_SHARE = 0.3;

/** Tentacles that wrap a ball of `radius`: 2 for a standard ball or a Slime half, 4 for a grown Titan. */
export function tentaclesFor(radius: number): number {
  const byWidth = Math.round((STANDARD_TENTACLES * radius) / STANDARD_BALL_RADIUS);
  return Math.max(STANDARD_TENTACLES, byWidth);
}

/** A Kraken's state, read from any ball state (undefined for other balls). */
export function krakenStateOf(ball: BallState): KrakenState | undefined {
  const { nextGrabTick, burstTick, spots, holds } = ball.abilityState;
  if (typeof nextGrabTick !== 'number' || typeof burstTick !== 'number') return undefined;
  if (!Array.isArray(spots) || typeof holds !== 'object' || holds === null) return undefined;
  return {
    nextGrabTick,
    burstTick,
    spots: spots as readonly Spot[],
    holds: holds as Readonly<Record<string, number>>,
  };
}

const sameHolds = (a: KrakenState['holds'], b: KrakenState['holds']): boolean => {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every((id) => a[id] === b[id]);
};

const within = (spot: Spot, ball: BallState): boolean => {
  const dx = spot.x - ball.position.x;
  const dy = spot.y - ball.position.y;
  return Math.sqrt(dx * dx + dy * dy) <= GRAB_REACH + ball.radius;
};

/**
 * Tentacles (ADR 0075): every GRAB_EVERY_TICKS, once it holds nothing, it marks a spot where each
 * enemy ball will be RIPPLE_TICKS later if it keeps its line, and ripples show there. Then the
 * tentacles burst up: a ball within GRAB_REACH of a spot (never a phased one) is held, cruising at
 * HELD_SHARE of its speed, and after HOLD_TICKS crushed once for CRUSH_PER_TENTACLE a tentacle, a
 * wider ball getting more. The Kraken anchors (ANCHOR_SHARE of its speed) while it holds.
 */
export const kraken = defineBall<KrakenState>({
  id: 'kraken',
  name: 'Kraken',
  description: 'Tentacles grab its enemy and crush it; more on big balls.',
  color: '#0891b2',
  ability: { name: 'Tentacles', shownBy: { kind: 'status', status: 'held' } },
  howItWorks: [
    `Every ${secondsOf(GRAB_EVERY_TICKS + RIPPLE_TICKS)} s ripples mark where its enemy is heading; ${secondsOf(RIPPLE_TICKS)} s later tentacles rise there and wrap it.`,
    `A wrapped ball moves at ${percentOf(HELD_SHARE)}; after ${secondsOf(HOLD_TICKS)} s it is crushed for ${CRUSH_PER_TENTACLE} a tentacle: ${CRUSH_PER_TENTACLE * STANDARD_TENTACLES} on most balls, more on big ones. It anchors while it squeezes.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 62,
  contactDamage: 16,
  initialAbilityState: { nextGrabTick: FIRST_GRAB_TICK, burstTick: -1, spots: [], holds: {} },
  cruiseSpeed: (state, stats) =>
    Object.keys(state.holds).length > 0 ? stats.speed * ANCHOR_SHARE : stats.speed,
  hooks: {
    onTick: ({ world, self, isPhased }) => {
      const state = self.abilityState;
      const { tick } = world;
      const enemies = world.balls.filter(
        (ball) => sideOf(ball) !== sideOf(self) && ball.health > 0,
      );
      const actions: AbilityAction<KrakenState>[] = [];
      let { nextGrabTick, burstTick, spots } = state;
      // A grip that is up crushes; one on a ball now gone simply ends.
      const holds: Record<string, number> = {};
      for (const [id, crushTick] of Object.entries(state.holds)) {
        const ball = enemies.find((enemy) => enemy.id === id);
        if (ball === undefined) continue;
        if (crushTick > tick) holds[id] = crushTick;
        else {
          const amount = CRUSH_PER_TENTACLE * tentaclesFor(ball.radius);
          actions.push({ kind: 'damage', targetId: id, amount });
        }
      }
      // The call: a spot ahead of each enemy ball, where it will be if it keeps its line.
      if (burstTick < 0 && tick >= nextGrabTick && Object.keys(holds).length === 0) {
        const ahead = RIPPLE_TICKS / TICK_RATE;
        const size = world.arena.size;
        spots = enemies.map((ball) => ({
          x: Math.min(size, Math.max(0, ball.position.x + ball.velocity.x * ahead)),
          y: Math.min(size, Math.max(0, ball.position.y + ball.velocity.y * ahead)),
        }));
        burstTick = tick + RIPPLE_TICKS;
      }
      // The burst: every enemy ball still near a spot is wrapped.
      if (burstTick >= 0 && tick >= burstTick) {
        for (const ball of enemies) {
          if (isPhased(ball) || !spots.some((spot) => within(spot, ball))) continue;
          holds[ball.id] = tick + HOLD_TICKS;
          actions.push({
            kind: 'applyStatus',
            targetId: ball.id,
            status: 'held',
            durationTicks: HOLD_TICKS,
          });
        }
        burstTick = -1;
        spots = [];
        nextGrabTick = tick + GRAB_EVERY_TICKS;
      }
      const same =
        nextGrabTick === state.nextGrabTick &&
        burstTick === state.burstTick &&
        spots === state.spots &&
        sameHolds(holds, state.holds);
      if (same) return actions;
      const next: KrakenState = { nextGrabTick, burstTick, spots, holds };
      return [{ kind: 'setAbilityState', state: next }, ...actions];
    },
  },
});
