// PROTOTYPE ONLY (proto/ball-looks): draw cost of each old and new design, the whole ball as
// drawBall draws it (body, markings, outline), over every state of its gallery timeline.
import type { Entry } from './entries.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { TIMELINES } from './timelines.ts';
import { paint } from './main.ts';

const PHONE = 340 / 1016;
const DESKTOP = 720 / 1016;
const ROUNDS = 6;

export interface BenchRow {
  readonly id: string;
  readonly look: string;
  readonly size: 'phone' | 'desktop';
  readonly oldMicros: number;
  readonly newMicros: number;
}

function costOf(id: string, design: BallDesign, unit: number, canvas: HTMLCanvasElement): number {
  const timeline = TIMELINES[id];
  if (timeline === undefined) return 0;
  const states = Array.from({ length: 600 }, (_, tick) => timeline(tick));
  // Warm up, then time the best of ROUNDS passes (the least disturbed by anything else).
  for (const state of states) paint(canvas, id, design, state, unit);
  let best = Number.POSITIVE_INFINITY;
  for (let round = 0; round < ROUNDS; round++) {
    const began = performance.now();
    for (const state of states) paint(canvas, id, design, state, unit);
    best = Math.min(best, (performance.now() - began) / states.length);
  }
  return best * 1000;
}

export function runBench(entries: readonly Entry[]): BenchRow[] {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const rows: BenchRow[] = [];
  for (const { id, old, looks } of entries) {
    for (const look of looks) {
      for (const [size, unit] of [
        ['phone', PHONE],
        ['desktop', DESKTOP],
      ] as const) {
        rows.push({
          id,
          look: look.label,
          size,
          oldMicros: costOf(id, old, unit, canvas),
          newMicros: costOf(id, look.design, unit, canvas),
        });
      }
    }
  }
  return rows;
}

export function wireBench(entries: readonly Entry[]): void {
  const button = document.getElementById('bench-run');
  const out = document.getElementById('bench-out');
  if (button === null || out === null) return;
  const run = (): BenchRow[] => {
    const rows = runBench(entries);
    out.textContent = rows
      .map(
        (row) =>
          `${row.id.padEnd(10)} ${row.look.padEnd(12)} ${row.size.padEnd(8)} old ${row.oldMicros.toFixed(1).padStart(6)} µs   new ${row.newMicros.toFixed(1).padStart(6)} µs`,
      )
      .join('\n');
    return rows;
  };
  button.addEventListener('click', () => run());
  (window as unknown as { galleryBench: () => BenchRow[] }).galleryBench = run;
}
