// Where unseen damage came from (ADR 0036): a small disc in the attacker's colour that pops beside
// the hit ball's health pill when poison, a burning patch's pulse or reflected spikes land. Driven
// by sim events on effect time, like every effect (ADR 0007); render state only.
import type { SimEvent } from '../sim/types.ts';
import { progress } from './motion.ts';
import { isUnseenDamage } from './ability-sign.ts';

/** How long a chip shows, in effect-time milliseconds. */
export const CHIP_MS = 650;

/** A chip on `targetId`'s bar in `sourceId`'s colour, from 1 (just landed) down to 0. */
export interface SourceChip {
  readonly targetId: string;
  readonly sourceId: string;
  readonly strength: number;
}

export interface SourceChips {
  apply(events: readonly SimEvent[], nowMs: number): void;
  chips(nowMs: number): readonly SourceChip[];
  isActive(nowMs: number): boolean;
  reset(): void;
}

export function createSourceChips(): SourceChips {
  /** One chip per hit ball: the latest unseen damage it took. */
  const starts = new Map<string, { sourceId: string; startMs: number }>();
  const strength = (startMs: number, nowMs: number) => 1 - progress(startMs, nowMs, CHIP_MS);
  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type === 'damage' && isUnseenDamage(event)) {
          starts.set(event.targetId, { sourceId: event.sourceId, startMs: nowMs });
        }
      }
    },
    chips(nowMs) {
      const shown: SourceChip[] = [];
      for (const [targetId, { sourceId, startMs }] of starts) {
        const left = strength(startMs, nowMs);
        if (left > 0) shown.push({ targetId, sourceId, strength: left });
        else starts.delete(targetId);
      }
      return shown;
    },
    isActive(nowMs) {
      return [...starts.values()].some(({ startMs }) => strength(startMs, nowMs) > 0);
    },
    reset() {
      starts.clear();
    },
  };
}
