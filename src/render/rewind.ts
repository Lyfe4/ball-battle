// The Chrono's rewind on screen (ADR 0034): a dotted trail from where it was knocked out to where
// it lands, and a fading ghost of it at the spot it left. Driven by the sim's `rewound` event and
// kept in the render layer, on effect time, like every effect (ADR 0007).
import type { SimEvent, Vec2 } from '../sim/types.ts';
import { theme } from './theme.ts';

/** A rewind being shown: where it left, where it landed, and how much of it is left (1 to 0). */
export interface RewindTrail {
  readonly ballId: string;
  readonly from: Vec2;
  readonly to: Vec2;
  readonly strength: number;
}

export interface Rewinds {
  apply(events: readonly SimEvent[], nowMs: number): void;
  trails(nowMs: number): readonly RewindTrail[];
  isActive(nowMs: number): boolean;
  reset(): void;
}

/** Tracks rewinds from `rewound` events and fades each over `theme.rewindMs` of effect time. */
export function createRewinds(): Rewinds {
  let started: { ballId: string; from: Vec2; to: Vec2; startMs: number }[] = [];
  const strength = (startMs: number, nowMs: number): number =>
    Math.max(0, 1 - (nowMs - startMs) / theme.rewindMs);
  return {
    apply(events, nowMs) {
      for (const event of events) {
        if (event.type !== 'rewound') continue;
        started.push({ ballId: event.ballId, from: event.from, to: event.to, startMs: nowMs });
      }
    },
    trails(nowMs) {
      return started
        .map(({ startMs, ...trail }) => ({ ...trail, strength: strength(startMs, nowMs) }))
        .filter((trail) => trail.strength > 0);
    },
    isActive(nowMs) {
      return started.some(({ startMs }) => strength(startMs, nowMs) > 0);
    },
    reset() {
      started = [];
    },
  };
}
