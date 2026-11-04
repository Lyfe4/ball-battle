import type { SimEvent, Vec2 } from '../sim/types.ts';
import { impactsOf, impactStrength, shakeOf, type WallBounce } from './impact.ts';
import {
  ghostDone,
  ghostHealth,
  progress,
  shakeOffset,
  squashScale,
  winnerRing,
  type GhostEntry,
} from './motion.ts';
import { burst, burstSeed, particleAt, type Dot, type Particle } from './particles.ts';
import { theme } from './theme.ts';

/** How long a damage flash lasts, in effect-time milliseconds. */
export const FLASH_MS = 200;

/** How long a heal pulse lasts, in effect-time milliseconds. */
export const HEAL_MS = 450;

/** How long a projectile hit spark lasts, in effect-time milliseconds. */
export const SPARK_MS = 250;

/** How long a zone strike's flash and bolt last, in effect-time milliseconds. */
export const STRIKE_MS = 350;

/** A spark where a projectile hit, with its strength from 1 (just hit) down to 0. */
export interface Spark {
  readonly point: Vec2;
  readonly strength: number;
}

/** A zone that just struck, with its strength from 1 (just struck) down to 0. */
export interface Strike {
  readonly zoneId: string;
  /** The ball whose zone it was, so its design can choose how the strike looks. */
  readonly ownerId: string;
  readonly position: Vec2;
  readonly radius: number;
  readonly strength: number;
}

/** A ball squashed along `normal`: scale `along` it and `across` it. */
export interface Squash {
  readonly normal: Vec2;
  readonly along: number;
  readonly across: number;
}

/** A ball that was knocked out and is breaking apart, `elapsedMs` into it. */
export interface Knockout {
  readonly ballId: string;
  readonly elapsedMs: number;
  readonly seed: number;
}

/** The winner's pulsing ring. */
export interface WinnerRing {
  readonly ballId: string;
  readonly growth: number;
  readonly alpha: number;
}

/**
 * Short-lived visual effects driven by sim events (ADR 0007). Lives entirely in the render layer:
 * it reads events and never touches the simulation. Times are effect time (real time with
 * hit-stops removed and slow-mo scaled), so effects freeze and slow with the match, and a flash
 * from the final blow still fades out after the match has stopped ticking.
 */
export interface Effects {
  apply(events: readonly SimEvent[], nowMs: number): void;
  /** Wall bounces read from consecutive worlds (see wallBounces). */
  bounced(bounces: readonly WallBounce[], nowMs: number): void;
  /** Reduced motion: no shake, squash, particles or shards; a static winner ring. */
  setReducedMotion(reduced: boolean): void;
  /** Flash strength for a ball, from 1 (just hit) down to 0. */
  flash(ballId: string, nowMs: number): number;
  /** Heal pulse strength for a ball, from 1 (just healed) down to 0. */
  heal(ballId: string, nowMs: number): number;
  /** Reduced-heal pulse strength for a ball, from 1 (just reduced) down to 0. */
  healReduced(ballId: string, nowMs: number): number;
  sparks(nowMs: number): readonly Spark[];
  strikes(nowMs: number): readonly Strike[];
  squash(ballId: string, nowMs: number): Squash | undefined;
  /** Health the bar's ghost segment reaches down from; equal to `health` when there is none. */
  ghost(ballId: string, health: number, nowMs: number): number;
  particles(nowMs: number): readonly Dot[];
  /** Screen offset in world units. */
  shake(nowMs: number): Vec2;
  /**
   * Balls knocked out this match, breaking apart or already broken. Their bodies are no longer
   * drawn; shards show while elapsedMs is under theme.shardMs. At most one per ball.
   */
  knockouts(nowMs: number): readonly Knockout[];
  winner(nowMs: number): WinnerRing | undefined;
  /** False until the knockout sequence has played; true at once for a time-limit end. */
  resultVisible(nowMs: number): boolean;
  /** True while any effect is still visible, so the caller knows to keep redrawing. */
  isActive(nowMs: number): boolean;
  reset(): void;
}

/** Remaining strength of an effect that started at `start` and lasts `durationMs`. */
function fade(start: number | undefined, nowMs: number, durationMs: number): number {
  if (start === undefined) return 0;
  return 1 - progress(start, nowMs, durationMs);
}

export function createEffects(): Effects {
  let reduced = false;
  const flashStarts = new Map<string, number>();
  const healStarts = new Map<string, number>();
  const squashes = new Map<string, { normal: Vec2; amount: number; startMs: number }>();
  const ghosts = new Map<string, GhostEntry>();
  let sparkStarts: { readonly point: Vec2; readonly start: number }[] = [];
  let strikeStarts: (Omit<Strike, 'strength'> & { readonly start: number })[] = [];
  let particles: Particle[] = [];
  let shake: { amplitude: number; startMs: number } | undefined;
  let knockouts: { ballId: string; startMs: number; seed: number }[] = [];
  let winner: { ballId: string; startMs: number } | undefined;
  let resultAtMs: number | undefined;

  const flash = (ballId: string, nowMs: number): number =>
    fade(flashStarts.get(ballId), nowMs, FLASH_MS);
  const reducedStarts = new Map<string, number>();
  const healReduced = (ballId: string, nowMs: number): number =>
    fade(reducedStarts.get(ballId), nowMs, theme.healReducedMs);
  const heal = (ballId: string, nowMs: number): number =>
    fade(healStarts.get(ballId), nowMs, HEAL_MS);
  const squashActive = (nowMs: number): boolean =>
    [...squashes.values()].some(({ startMs }) => progress(startMs, nowMs, theme.squashMs) < 1);

  const applyImpacts = (events: readonly SimEvent[], nowMs: number): void => {
    const tick = events[0]?.tick ?? 0;
    for (const impact of impactsOf(events)) {
      const strength = impactStrength(impact.damage);
      if (impact.normal !== undefined) {
        const amount = theme.squashImpact * strength;
        squashes.set(impact.targetId, { normal: impact.normal, amount, startMs: nowMs });
      }
      if (impact.point !== undefined && !reduced) {
        particles.push(...burst(impact.point, strength, burstSeed(tick, impact.targetId), nowMs));
      }
    }
    // Bounded however busy a match gets: the oldest particles go first.
    if (particles.length > theme.particleCap) particles = particles.slice(-theme.particleCap);
    const amplitude = shakeOf(events);
    if (amplitude > 0) shake = { amplitude, startMs: nowMs };
  };

  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type === 'damage') {
          flashStarts.set(event.targetId, nowMs);
          const before = event.healthAfter + event.amount;
          const from = ghostHealth(ghosts.get(event.targetId), before, nowMs);
          ghosts.set(event.targetId, { from, startMs: nowMs });
        }
        if (event.type === 'healed') healStarts.set(event.ballId, nowMs);
        if (event.type === 'healReduced') reducedStarts.set(event.ballId, nowMs);
        if (event.type === 'projectileHit') sparkStarts.push({ point: event.point, start: nowMs });
        if (event.type === 'zoneStruck') {
          const { zoneId, ownerId, position, radius } = event;
          strikeStarts.push({ zoneId, ownerId, position, radius, start: nowMs });
        }
        if (event.type === 'ballDefeated') {
          const seed = burstSeed(event.tick, event.ballId);
          knockouts.push({ ballId: event.ballId, startMs: nowMs, seed });
        }
        if (event.type === 'matchEnded') {
          const isKnockout = event.reason === 'knockout';
          resultAtMs = nowMs + (isKnockout ? theme.resultDelayMs : 0);
          if (isKnockout && event.result.kind === 'win') {
            winner = { ballId: event.result.winnerId, startMs: nowMs };
          }
        }
      }
      applyImpacts(events, nowMs);
    },
    bounced(bounces, nowMs) {
      for (const { ballId, normal } of bounces) {
        squashes.set(ballId, { normal, amount: theme.squashWall, startMs: nowMs });
      }
    },
    setReducedMotion(next) {
      reduced = next;
    },
    flash,
    heal,
    healReduced,
    sparks(nowMs) {
      // Drop finished sparks so the list never grows over a long match.
      sparkStarts = sparkStarts.filter(({ start }) => fade(start, nowMs, SPARK_MS) > 0);
      return sparkStarts.map(({ point, start }) => ({
        point,
        strength: fade(start, nowMs, SPARK_MS),
      }));
    },
    strikes(nowMs) {
      strikeStarts = strikeStarts.filter(({ start }) => fade(start, nowMs, STRIKE_MS) > 0);
      return strikeStarts.map(({ start, ...strike }) => ({
        ...strike,
        strength: fade(start, nowMs, STRIKE_MS),
      }));
    },
    squash(ballId, nowMs) {
      const entry = squashes.get(ballId);
      if (reduced || entry === undefined) return undefined;
      const p = progress(entry.startMs, nowMs, theme.squashMs);
      if (p >= 1) return undefined;
      return { normal: entry.normal, ...squashScale(entry.amount, p) };
    },
    ghost(ballId, health, nowMs) {
      const entry = ghosts.get(ballId);
      if (entry !== undefined && ghostDone(entry, nowMs)) ghosts.delete(ballId);
      return ghostHealth(ghosts.get(ballId), health, nowMs);
    },
    particles(nowMs) {
      const dots = particles.map((particle) => particleAt(particle, nowMs));
      particles = particles.filter((_, index) => dots[index] !== undefined);
      return dots.filter((dot): dot is Dot => dot !== undefined);
    },
    shake(nowMs) {
      if (reduced || shake === undefined) return { x: 0, y: 0 };
      return shakeOffset(shake.amplitude, progress(shake.startMs, nowMs, theme.shakeMs), nowMs);
    },
    knockouts(nowMs) {
      if (reduced) return [];
      return knockouts.map(({ ballId, startMs, seed }) => ({
        ballId,
        seed,
        elapsedMs: nowMs - startMs,
      }));
    },
    winner(nowMs) {
      if (winner === undefined) return undefined;
      const ring = winnerRing(progress(winner.startMs, nowMs, theme.winnerPulseMs), reduced);
      return ring.alpha > 0 ? { ballId: winner.ballId, ...ring } : undefined;
    },
    resultVisible(nowMs) {
      return resultAtMs !== undefined && nowMs >= resultAtMs;
    },
    isActive(nowMs) {
      return (
        [...flashStarts.keys()].some((ballId) => flash(ballId, nowMs) > 0) ||
        [...healStarts.keys()].some((ballId) => heal(ballId, nowMs) > 0) ||
        [...reducedStarts.keys()].some((ballId) => healReduced(ballId, nowMs) > 0) ||
        sparkStarts.some(({ start }) => fade(start, nowMs, SPARK_MS) > 0) ||
        strikeStarts.some(({ start }) => fade(start, nowMs, STRIKE_MS) > 0) ||
        particles.some((particle) => particleAt(particle, nowMs) !== undefined) ||
        squashActive(nowMs) ||
        [...ghosts.values()].some((entry) => !ghostDone(entry, nowMs)) ||
        (shake !== undefined && progress(shake.startMs, nowMs, theme.shakeMs) < 1) ||
        knockouts.some(({ startMs }) => progress(startMs, nowMs, theme.shardMs) < 1) ||
        (winner !== undefined && progress(winner.startMs, nowMs, theme.winnerPulseMs) < 1) ||
        (resultAtMs !== undefined && nowMs < resultAtMs)
      );
    },
    reset() {
      flashStarts.clear();
      healStarts.clear();
      reducedStarts.clear();
      squashes.clear();
      ghosts.clear();
      sparkStarts = [];
      strikeStarts = [];
      particles = [];
      shake = undefined;
      knockouts = [];
      winner = undefined;
      resultAtMs = undefined;
    },
  };
}
