import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { AbilityAction, BallState } from '../types.ts';

/** Where the Chrono was, and how it was doing, at one moment. */
export type ChronoMoment = Readonly<{
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
}>;

export type ChronoState = Readonly<{
  /** Its recent moments, oldest first: one every MOMENT_EVERY_TICKS, REWIND_MOMENTS at most. */
  history: readonly ChronoMoment[];
  /** It can rewind again from this tick (0: ready from the start). */
  readyTick: number;
}>;

/** A moment is kept every this many ticks. */
export const MOMENT_EVERY_TICKS = 15;
/** How many moments it keeps: it rewinds to the oldest, a quarter to half a second back. */
export const REWIND_MOMENTS = 2;
/** An ability hit of at least this much is a big hit: a heavy shot, a lightning strike. */
export const BIG_HIT = 20;
/** Ticks from a rewind until it can rewind again (5 s). */
export const RECHARGE_TICKS = 600;

/** The Chrono's recent moments, read from any ball state (empty for other balls). */
export function historyOf(ball: BallState): readonly ChronoMoment[] {
  const history = ball.abilityState['history'];
  return Array.isArray(history) ? (history as readonly ChronoMoment[]) : [];
}

/** True when a Chrono can rewind on `tick` (false for other balls). */
export function isCharged(ball: BallState, tick: number): boolean {
  const ready = ball.abilityState['readyTick'];
  return typeof ready === 'number' && tick >= ready;
}

/** Back to its oldest moment, if it is charged and has one, and recharge. */
function rewind(state: ChronoState, tick: number): readonly AbilityAction<ChronoState>[] {
  const oldest = state.history[0];
  if (tick < state.readyTick || oldest === undefined) return [];
  return [
    {
      kind: 'rewind',
      position: { x: oldest.x, y: oldest.y },
      velocity: { x: oldest.vx, y: oldest.vy },
      health: oldest.health,
    },
    { kind: 'setAbilityState', state: { history: [], readyTick: tick + RECHARGE_TICKS } },
  ];
}

/**
 * Rewinds big hits (ADR 0034, 0045): when an ability hits it for BIG_HIT or more while it is
 * charged, it goes back to where it was a moment earlier, with the health it had then, and
 * recharges for RECHARGE_TICKS. That undoes the big hit and little else. A hit that would knock it
 * out counts as big, whatever it was. Small hits (poison ticks,
 * burns, arrows) and bumps are never rewound, and what has already landed on it stays: a status
 * keeps ticking.
 */
export const chrono = defineBall<ChronoState>({
  id: 'chrono',
  name: 'Chrono',
  description: 'Rewinds big hits, then recharges.',
  color: '#d4a373',
  ability: { name: 'Rewind', shownBy: { kind: 'rewound' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 61,
  contactDamage: 22,
  initialAbilityState: { history: [], readyTick: 0 },
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick % MOMENT_EVERY_TICKS !== 0) return [];
      const { position, velocity, health } = self;
      const moment = { x: position.x, y: position.y, vx: velocity.x, vy: velocity.y, health };
      const history = [...self.abilityState.history, moment].slice(-REWIND_MOMENTS);
      return [{ kind: 'setAbilityState', state: { ...self.abilityState, history } }];
    },
    onDamageTaken: ({ world, self, amount, cause }) =>
      cause === 'ability' && amount >= BIG_HIT ? rewind(self.abilityState, world.tick) : [],
    // A hit that would knock it out is the biggest of all: a lethal hit fires no onDamageTaken.
    onKnockedOut: ({ world, self }) => rewind(self.abilityState, world.tick),
  },
});
