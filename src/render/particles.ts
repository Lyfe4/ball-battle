// Pure geometry for impact particles and knockout shards (ADR 0007). Random-looking, but seeded
// from sim facts (tick, ball index), so a replay draws the same burst. Never Math.random.
import { createStream, deriveSeed } from '../sim/rng.ts';
import type { Vec2 } from '../sim/types.ts';
import { progress } from './motion.ts';
import { theme } from './theme.ts';

/** One particle as spawned: where, which way, and when. */
export interface Particle {
  readonly origin: Vec2;
  /** World units per second at launch; it slows to a stop over its life. */
  readonly velocity: Vec2;
  readonly startMs: number;
}

export interface Dot {
  readonly position: Vec2;
  readonly radius: number;
  readonly alpha: number;
}

/** Fraction of full travel after `p` of a life spent decelerating evenly to a stop. */
const travelled = (p: number): number => 2 * p - p * p;

/** A seed from a tick and a ball id, so each burst differs but replays identically. */
export function burstSeed(tick: number, ballId: string): number {
  let hash = tick;
  for (let i = 0; i < ballId.length; i++) hash = Math.imul(hash, 31) + ballId.charCodeAt(i);
  return deriveSeed([hash >>> 0]);
}

/** A few particles from `point`: more, and faster, for a stronger impact (0 to 1). */
export function burst(
  point: Vec2,
  strength: number,
  seed: number,
  startMs: number,
): readonly Particle[] {
  const random = createStream(seed);
  const count = Math.round(theme.particleMin + (theme.particleMax - theme.particleMin) * strength);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const speed = theme.particleSpeed * (0.5 + 0.5 * random()) * (0.6 + 0.4 * strength);
    particles.push({
      origin: point,
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      startMs,
    });
  }
  return particles;
}

/** Where a particle is now, or undefined once it has faded. */
export function particleAt(particle: Particle, nowMs: number): Dot | undefined {
  const p = progress(particle.startMs, nowMs, theme.particleMs);
  if (p >= 1) return undefined;
  const seconds = (theme.particleMs / 1000) * travelled(p) * 0.5;
  return {
    position: {
      x: particle.origin.x + particle.velocity.x * seconds,
      y: particle.origin.y + particle.velocity.y * seconds,
    },
    radius: theme.particleRadius * (1 - 0.5 * p),
    alpha: 1 - p,
  };
}

/** One wedge of a broken ball. Angles in radians around the ball's centre. */
export interface ShardPiece {
  readonly from: number;
  readonly to: number;
  /** Unit vector it flies along: outwards through its middle, slightly varied. */
  readonly direction: Vec2;
  /** Radians it turns over its whole flight. */
  readonly spin: number;
}

/** The wedges a ball breaks into, seeded so a replay breaks the same way. */
export function shardPieces(seed: number): readonly ShardPiece[] {
  const random = createStream(seed);
  const count = theme.shardCount;
  const offset = random() * Math.PI * 2;
  const pieces: ShardPiece[] = [];
  for (let i = 0; i < count; i++) {
    const from = offset + (i / count) * Math.PI * 2;
    const to = offset + ((i + 1) / count) * Math.PI * 2;
    const middle = (from + to) / 2 + (random() - 0.5) * 0.5;
    pieces.push({
      from,
      to,
      direction: { x: Math.cos(middle), y: Math.sin(middle) },
      spin: (random() - 0.5) * 2,
    });
  }
  return pieces;
}

/** A wedge's outline now (centre, then points along its arc), or undefined once it has faded. */
export function shardAt(
  piece: ShardPiece,
  center: Vec2,
  radius: number,
  startMs: number,
  nowMs: number,
): { points: readonly Vec2[]; alpha: number } | undefined {
  const p = progress(startMs, nowMs, theme.shardMs);
  if (p >= 1) return undefined;
  const distance = theme.shardSpeed * (theme.shardMs / 1000) * travelled(p) * 0.5;
  const turn = piece.spin * p;
  const cx = center.x + piece.direction.x * distance;
  const cy = center.y + piece.direction.y * distance;
  const shrink = radius * (1 - 0.3 * p);
  const points: Vec2[] = [{ x: cx, y: cy }];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const angle = piece.from + ((piece.to - piece.from) * i) / steps + turn;
    points.push({ x: cx + Math.cos(angle) * shrink, y: cy + Math.sin(angle) * shrink });
  }
  return { points, alpha: 1 - p };
}
