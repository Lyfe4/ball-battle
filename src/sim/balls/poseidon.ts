import { STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { AbilityAction, BallState, Vec2 } from '../types.ts';

export type PoseidonState = Readonly<{
  /** The tick of its next wave. */
  nextWave: number;
  /** The tick its last wave began (-WAVE_EVERY_TICKS before the first). */
  waveAt: number;
  /** The way the last wave sweeps: one axis, +1 or -1 (the other 0). */
  dirX: number;
  dirY: number;
  /** Balls the last wave has thrown. */
  swept: readonly string[];
  /** Thrown balls that have already crashed into the far wall. */
  crashed: readonly string[];
}>;

/** Its first wave, 2 s in. */
export const FIRST_WAVE_TICK = 2 * TICK_RATE;
/** Ticks from one wave to the next. */
export const WAVE_EVERY_TICKS = 4 * TICK_RATE;
/** Ticks a wave takes to sweep from one wall to the other. */
export const WAVE_TICKS = 36;
/** How deep the wave is, in world units: a ball inside it is pushed every tick. */
export const WAVE_DEPTH = 150;
/** How hard the wave pushes a standard ball each tick it is inside it (a steer share). */
export const WAVE_PUSH = 0.35;
/** How long after a wave begins a ball it threw can still crash. */
export const CRASH_BY_TICKS = 2 * TICK_RATE;
/** What a crash deals to a standard-size ball; a heavier one takes its lightness of it. */
export const CRASH_DAMAGE = 12;
/** A ball whose edge is this close to the far wall, moving away from it, has just hit it. */
export const WALL_GAP = 20;

/**
 * How light a ball is next to a standard one, by width (standard radius / its radius), at most 1:
 * the share of a throw and of a crash it takes. A grown Titan (r 90) takes 0.56.
 */
export function lightnessOf(radius: number): number {
  const share = STANDARD_BALL_RADIUS / radius;
  return share > 1 ? 1 : share;
}

/** How far `point` is from the wall a wave sweeping (dirX, dirY) starts at. */
export function alongWave(point: Vec2, dirX: number, dirY: number, size: number): number {
  if (dirX > 0) return point.x;
  if (dirX < 0) return size - point.x;
  if (dirY > 0) return point.y;
  return size - point.y;
}

/** How far a wave that began on `waveAt` has come from its starting wall on `tick`. */
export function waveFront(waveAt: number, tick: number, size: number): number {
  return ((tick - waveAt + 1) * size) / WAVE_TICKS;
}

/** The way a wave sweeps: along the main axis from Poseidon toward its nearest enemy. */
function waveDirection(self: BallState, enemies: readonly BallState[]): Vec2 {
  let best: BallState | undefined;
  let bestDistance = Infinity;
  for (const ball of enemies) {
    const dx = ball.position.x - self.position.x;
    const dy = ball.position.y - self.position.y;
    if (dx * dx + dy * dy < bestDistance) {
      bestDistance = dx * dx + dy * dy;
      best = ball;
    }
  }
  const dx = best === undefined ? 1 : best.position.x - self.position.x;
  const dy = best === undefined ? 0 : best.position.y - self.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: dx < 0 ? -1 : 1, y: 0 };
  return { x: 0, y: dy < 0 ? -1 : 1 };
}

/**
 * Poseidon (prototype): every WAVE_EVERY_TICKS a wave sweeps the whole court, from the wall behind
 * it toward its nearest enemy. Each enemy inside the wave is pushed toward the far wall every tick
 * (steered by WAVE_PUSH times its lightness), and one that hits that wall within CRASH_BY_TICKS of the wave crashes for
 * CRASH_DAMAGE times its lightness. Heavy balls (a grown Titan) barely turn and crash softly; a phased ball is not swept.
 */
export const poseidon = defineBall<PoseidonState>({
  id: 'poseidon',
  name: 'Poseidon',
  description: 'Waves sweep the court and dash its enemies against the wall.',
  color: '#3cc9a6',
  ability: { name: 'Wave', shownBy: { kind: 'hookDamage', hook: 'onTick' }, tipOn: 'struck' },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 66,
  contactDamage: 13,
  initialAbilityState: {
    nextWave: FIRST_WAVE_TICK,
    waveAt: -WAVE_EVERY_TICKS,
    dirX: 1,
    dirY: 0,
    swept: [],
    crashed: [],
  },
  hooks: {
    onTick: ({ world, self, isPhased }) => {
      const size = world.arena.size;
      const enemies = world.balls.filter(
        (ball) => sideOf(ball) !== sideOf(self) && ball.health > 0,
      );
      let state = self.abilityState;
      let changed = false;
      if (world.tick >= state.nextWave) {
        const dir = waveDirection(self, enemies);
        state = {
          nextWave: world.tick + WAVE_EVERY_TICKS,
          waveAt: world.tick,
          dirX: dir.x,
          dirY: dir.y,
          swept: [],
          crashed: [],
        };
        changed = true;
      }
      const { waveAt, dirX, dirY } = state;
      const since = world.tick - waveAt;
      if (since >= CRASH_BY_TICKS) return changed ? [{ kind: 'setAbilityState', state }] : [];
      const actions: AbilityAction<PoseidonState>[] = [];
      const front = waveFront(waveAt, world.tick, size);
      const swept = [...state.swept];
      const crashed = [...state.crashed];
      for (const ball of enemies) {
        const along = alongWave(ball.position, dirX, dirY, size);
        if (since < WAVE_TICKS && along <= front && along > front - WAVE_DEPTH) {
          if (isPhased(ball)) continue;
          if (!swept.includes(ball.id)) swept.push(ball.id);
          actions.push({
            kind: 'steer',
            targetId: ball.id,
            toward: {
              x: dirX === 0 ? ball.position.x : dirX > 0 ? size : 0,
              y: dirY === 0 ? ball.position.y : dirY > 0 ? size : 0,
            },
            share: WAVE_PUSH * lightnessOf(ball.radius),
          });
          continue;
        }
        if (!swept.includes(ball.id) || crashed.includes(ball.id)) continue;
        const atFarWall = size - along - ball.radius <= WALL_GAP;
        const awayFromIt = ball.velocity.x * dirX + ball.velocity.y * dirY < 0;
        if (!atFarWall || !awayFromIt) continue;
        crashed.push(ball.id);
        actions.push({
          kind: 'damage',
          targetId: ball.id,
          amount: Math.round(CRASH_DAMAGE * lightnessOf(ball.radius)),
        });
      }
      const news = swept.length !== state.swept.length || crashed.length !== state.crashed.length;
      if (!changed && !news) return actions;
      return [{ kind: 'setAbilityState', state: { ...state, swept, crashed } }, ...actions];
    },
  },
});
