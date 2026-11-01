import type { SimEvent } from '../sim/types.ts';

/** How long a damage flash lasts, in real milliseconds. */
export const FLASH_MS = 200;

/**
 * Short-lived visual effects driven by sim events. Lives entirely in the render layer: it reads
 * events and never touches the simulation. Uses real time rather than ticks so a flash from the
 * final blow still fades out after the match has stopped ticking.
 */
export interface Effects {
  apply(events: readonly SimEvent[], nowMs: number): void;
  /** Flash strength for a ball, from 1 (just hit) down to 0. */
  flash(ballId: string, nowMs: number): number;
  /** True while any effect is still visible, so the caller knows to keep redrawing. */
  isActive(nowMs: number): boolean;
  reset(): void;
}

export function createEffects(): Effects {
  const flashStarts = new Map<string, number>();

  const flash = (ballId: string, nowMs: number): number => {
    const start = flashStarts.get(ballId);
    if (start === undefined) return 0;
    const progress = (nowMs - start) / FLASH_MS;
    return Math.min(1, Math.max(0, 1 - progress));
  };

  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type === 'damage') flashStarts.set(event.targetId, nowMs);
      }
    },
    flash,
    isActive(nowMs) {
      return [...flashStarts.keys()].some((ballId) => flash(ballId, nowMs) > 0);
    },
    reset() {
      flashStarts.clear();
    },
  };
}
