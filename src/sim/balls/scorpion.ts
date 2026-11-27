import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { Actions, BallState, Vec2 } from '../types.ts';
import { secondsOf } from './how-it-works.ts';
import { nearestTarget } from './targeting.ts';

export type ScorpionState = Readonly<{
  /** The first tick its tail may sting again. */
  readyTick: number;
  /** Its last sting: when, and the point the tail struck (for drawing the jab). -1 if none yet. */
  stungTick: number;
  stungX: number;
  stungY: number;
}>;

/** How far its tail reaches past its own edge, to the edge of what it stings. */
export const STING_REACH = 110;
/** Ticks from one sting to the next. */
export const STING_COOLDOWN_TICKS = 60;
/** What a sting deals: a hook's own damage, so it lands as it is (no poison). */
export const STING_DAMAGE = 8;
/** The strike-once circle that swats a skull (a minion has no health to sting). */
export const STING_POINT_RADIUS = 24;
/** How long the drawn jab lasts after a sting. */
export const JAB_TICKS = 10;
/** Its first sting may come half a second in, so a match doesn't open with one. */
const FIRST_READY_TICK = 30;

/** The Scorpion's state, read from any ball (undefined for other balls). */
export function scorpionStateOf(ball: BallState): ScorpionState | undefined {
  const { readyTick, stungTick, stungX, stungY } = ball.abilityState;
  if (typeof readyTick !== 'number' || typeof stungTick !== 'number') return undefined;
  if (typeof stungX !== 'number' || typeof stungY !== 'number') return undefined;
  return { readyTick, stungTick, stungX, stungY };
}

function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A long tail (prototype): whenever the nearest enemy (a ball or a minion) comes within
 * STING_REACH of its edge, the tail stings it for STING_DAMAGE, then rests for
 * STING_COOLDOWN_TICKS. It stings before contact, so a ball that must close in is stung on the way
 * every time; a ball that hits from afar never comes into reach. It is a reflex, not an aimed
 * attack: it goes for the nearest body (a ball or a skull, never a Mirage's copy). A ball is stung
 * directly; a skull is swatted by a small strike-once circle on it.
 */
export const scorpion = defineBall<ScorpionState>({
  id: 'scorpion',
  name: 'Scorpion',
  description: 'Its tail stings anything that comes within reach.',
  color: '#f59e0b',
  ability: { name: 'Sting', shownBy: { kind: 'hookDamage', hook: 'onTick' }, tipOn: 'struck' },
  howItWorks: [
    `Its tail stings the nearest enemy for ${STING_DAMAGE} once it comes within reach, at most every ${secondsOf(STING_COOLDOWN_TICKS)} s.`,
    'It stings before they touch; a ball that stays away is never stung.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 52,
  contactDamage: 13,
  initialAbilityState: { readyTick: FIRST_READY_TICK, stungTick: -1, stungX: 0, stungY: 0 },
  hooks: {
    onTick: ({ world, self }): Actions<ScorpionState> => {
      if (world.tick < self.abilityState.readyTick) return [];
      // Not aimed: it stings the nearest body itself, so a copy never draws it (ADR 0077).
      const target = nearestTarget(self, world.balls, world.minions, (ball) => ball.position);
      if (target === undefined) return [];
      const ball =
        target.kind === 'ball' ? world.balls.find((each) => each.id === target.id) : undefined;
      const minion =
        target.kind === 'minion' ? world.minions.find((each) => each.id === target.id) : undefined;
      const body = ball ?? minion;
      if (body === undefined) return [];
      const gap = distance(self.position, body.position) - self.radius - body.radius;
      if (gap > STING_REACH) return [];
      const state = {
        kind: 'setAbilityState' as const,
        state: {
          readyTick: world.tick + STING_COOLDOWN_TICKS,
          stungTick: world.tick,
          stungX: body.position.x,
          stungY: body.position.y,
        },
      };
      if (ball !== undefined) {
        return [{ kind: 'damage', targetId: ball.id, amount: STING_DAMAGE }, state];
      }
      // A skull has no health: the tail swats it with a strike-once circle on it.
      return [
        {
          kind: 'spawnZone',
          position: body.position,
          radius: STING_POINT_RADIUS,
          damage: STING_DAMAGE,
          delayTicks: 1,
        },
        state,
      ];
    },
  },
});
