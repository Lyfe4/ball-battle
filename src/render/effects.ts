import type { SimEvent, Vec2 } from '../sim/types.ts';

/** How long a damage flash lasts, in real milliseconds. */
export const FLASH_MS = 200;

/** How long a heal pulse lasts, in real milliseconds. */
export const HEAL_MS = 450;

/** How long a projectile hit spark lasts, in real milliseconds. */
export const SPARK_MS = 250;

/** How long a zone strike's flash and bolt last, in real milliseconds. */
export const STRIKE_MS = 350;

/** A spark where a projectile hit, with its strength from 1 (just hit) down to 0. */
export interface Spark {
  readonly point: Vec2;
  readonly strength: number;
}

/** A zone that just struck, with its strength from 1 (just struck) down to 0. */
export interface Strike {
  readonly zoneId: string;
  readonly position: Vec2;
  readonly radius: number;
  readonly strength: number;
}

/**
 * Short-lived visual effects driven by sim events. Lives entirely in the render layer: it reads
 * events and never touches the simulation. Uses real time rather than ticks so a flash from the
 * final blow still fades out after the match has stopped ticking.
 */
export interface Effects {
  apply(events: readonly SimEvent[], nowMs: number): void;
  /** Flash strength for a ball, from 1 (just hit) down to 0. */
  flash(ballId: string, nowMs: number): number;
  /** Heal pulse strength for a ball, from 1 (just healed) down to 0. */
  heal(ballId: string, nowMs: number): number;
  /** Projectile hit sparks still visible. */
  sparks(nowMs: number): readonly Spark[];
  /** Zone strikes still visible. */
  strikes(nowMs: number): readonly Strike[];
  /** True while any effect is still visible, so the caller knows to keep redrawing. */
  isActive(nowMs: number): boolean;
  reset(): void;
}

/** Remaining strength of an effect that started at `start` and lasts `durationMs`. */
function fade(start: number | undefined, nowMs: number, durationMs: number): number {
  if (start === undefined) return 0;
  return Math.min(1, Math.max(0, 1 - (nowMs - start) / durationMs));
}

export function createEffects(): Effects {
  const flashStarts = new Map<string, number>();
  const healStarts = new Map<string, number>();
  let sparkStarts: { readonly point: Vec2; readonly start: number }[] = [];
  let strikeStarts: (Omit<Strike, 'strength'> & { readonly start: number })[] = [];

  const flash = (ballId: string, nowMs: number): number =>
    fade(flashStarts.get(ballId), nowMs, FLASH_MS);
  const heal = (ballId: string, nowMs: number): number =>
    fade(healStarts.get(ballId), nowMs, HEAL_MS);

  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type === 'damage') flashStarts.set(event.targetId, nowMs);
        if (event.type === 'healed') healStarts.set(event.ballId, nowMs);
        if (event.type === 'projectileHit') sparkStarts.push({ point: event.point, start: nowMs });
        if (event.type === 'zoneStruck') {
          const { zoneId, position, radius } = event;
          strikeStarts.push({ zoneId, position, radius, start: nowMs });
        }
      }
    },
    flash,
    heal,
    sparks(nowMs) {
      // Drop finished sparks so the list never grows over a long match.
      sparkStarts = sparkStarts.filter(({ start }) => fade(start, nowMs, SPARK_MS) > 0);
      return sparkStarts.map(({ point, start }) => ({
        point,
        strength: fade(start, nowMs, SPARK_MS),
      }));
    },
    strikes(nowMs) {
      // Drop finished strikes so the list never grows over a long match.
      strikeStarts = strikeStarts.filter(({ start }) => fade(start, nowMs, STRIKE_MS) > 0);
      return strikeStarts.map(({ start, ...strike }) => ({
        ...strike,
        strength: fade(start, nowMs, STRIKE_MS),
      }));
    },
    isActive(nowMs) {
      return (
        [...flashStarts.keys()].some((ballId) => flash(ballId, nowMs) > 0) ||
        [...healStarts.keys()].some((ballId) => heal(ballId, nowMs) > 0) ||
        sparkStarts.some(({ start }) => fade(start, nowMs, SPARK_MS) > 0) ||
        strikeStarts.some(({ start }) => fade(start, nowMs, STRIKE_MS) > 0)
      );
    },
    reset() {
      flashStarts.clear();
      healStarts.clear();
      sparkStarts = [];
      strikeStarts = [];
    },
  };
}
