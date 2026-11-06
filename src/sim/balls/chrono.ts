import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

/** Where the Chrono was, and how it was doing, at one moment. */
export type ChronoMoment = Readonly<{
  tick: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
}>;

export type ChronoState = Readonly<{
  /** Its recent moments, oldest first: one every MOMENT_EVERY_TICKS, REWIND_MOMENTS at most. */
  history: readonly ChronoMoment[];
  /** True once it has rewound: it rewinds once per match. */
  used: boolean;
}>;

/** A moment is kept every this many ticks. */
export const MOMENT_EVERY_TICKS = 15;
/** How many moments it keeps: it rewinds to the oldest, about half a second back. */
export const REWIND_MOMENTS = 2;

/** The Chrono's recent moments, read from any ball state (empty for other balls). */
export function historyOf(ball: BallState): readonly ChronoMoment[] {
  const history = ball.abilityState['history'];
  return Array.isArray(history) ? (history as readonly ChronoMoment[]) : [];
}

/** True once the Chrono has used its rewind (false for other balls). */
export function hasRewound(ball: BallState): boolean {
  return ball.abilityState['used'] === true;
}

/**
 * Once per match, when a hit would knock it out, it rewinds: back to where it was about half a
 * second earlier, with the health it had then (ADR 0034). That undoes one big hit and little of a
 * drip. Its history is a few plain moments in its
 * ability state, taken on a fixed rhythm. What has already landed on it stays: a status (Venom's
 * poison) keeps ticking, so a rewind against a poisoner buys little.
 */
export const chrono = defineBall<ChronoState>({
  id: 'chrono',
  name: 'Chrono',
  description: 'Once a match, a knockout hit rewinds it half a second: the hit is undone.',
  color: '#d4a373',
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 78,
  contactDamage: 20,
  initialAbilityState: { history: [], used: false },
  hooks: {
    onTick: ({ world, self }) => {
      if (self.abilityState.used || world.tick % MOMENT_EVERY_TICKS !== 0) return [];
      const { position, velocity, health } = self;
      const moment: ChronoMoment = {
        tick: world.tick,
        x: position.x,
        y: position.y,
        vx: velocity.x,
        vy: velocity.y,
        health,
      };
      const history = [...self.abilityState.history, moment].slice(-REWIND_MOMENTS);
      return [{ kind: 'setAbilityState', state: { history, used: false } }];
    },
    onKnockedOut: ({ self }) => {
      const oldest = self.abilityState.history[0];
      if (self.abilityState.used || oldest === undefined) return [];
      return [
        {
          kind: 'rewind',
          position: { x: oldest.x, y: oldest.y },
          velocity: { x: oldest.vx, y: oldest.vy },
          health: oldest.health,
        },
        { kind: 'setAbilityState', state: { history: [], used: true } },
      ];
    },
  },
});
