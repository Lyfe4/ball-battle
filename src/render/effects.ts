import type { SimEvent } from '../sim/types.ts';

/** How long a damage flash lasts, in real milliseconds. */
export const FLASH_MS = 200;

/** How long a heal pulse lasts, in real milliseconds. */
export const HEAL_MS = 450;

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

  const flash = (ballId: string, nowMs: number): number =>
    fade(flashStarts.get(ballId), nowMs, FLASH_MS);
  const heal = (ballId: string, nowMs: number): number =>
    fade(healStarts.get(ballId), nowMs, HEAL_MS);

  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type === 'damage') flashStarts.set(event.targetId, nowMs);
        if (event.type === 'healed') healStarts.set(event.ballId, nowMs);
      }
    },
    flash,
    heal,
    isActive(nowMs) {
      return (
        [...flashStarts.keys()].some((ballId) => flash(ballId, nowMs) > 0) ||
        [...healStarts.keys()].some((ballId) => heal(ballId, nowMs) > 0)
      );
    },
    reset() {
      flashStarts.clear();
      healStarts.clear();
    },
  };
}
