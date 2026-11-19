// PROTOTYPE ONLY (proto/ball-looks): every state of each ball at once, old above new, at phone and
// desktop size: the gallery's ?strips view, and the source of the proposal's screenshots.
import { BALL_DESIGNS } from '../render/ball-designs/index.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { TIMELINES } from './timelines.ts';

const PHONE = 340 / 1016;
const DESKTOP = 720 / 1016;

/** The ticks that show each step of a ball's timeline, settled (any hit flash faded). */
const SAMPLES: Readonly<Record<string, readonly number[]>> = {
  titan: [0, 84, 167, 250, 334],
  berserker: [0, 1, 2, 3, 5, 6, 7].map((step) => step * 66 + 40),
  speedster: [0, 1, 2, 3, 4, 5, 7].map((step) => step * 66 + 40),
  thorns: [40],
  boomerang: [10, 60],
  battery: [0, 1, 2, 3, 4, 6].map((step) => step * 66 + 40),
};

export function renderStrips(
  root: HTMLElement,
  entries: readonly { id: string; old: BallDesign }[],
  paint: (
    canvas: HTMLCanvasElement,
    id: string,
    design: BallDesign,
    state: ReturnType<NonNullable<(typeof TIMELINES)[string]>>,
    unit: number,
  ) => void,
  canvasFor: (cssSize: number) => HTMLCanvasElement,
): void {
  for (const { id, old } of entries) {
    const fresh = BALL_DESIGNS.get(id);
    const timeline = TIMELINES[id];
    if (fresh === undefined || timeline === undefined) continue;
    const section = document.createElement('section');
    section.className = 'strip';
    section.id = `strip-${id}`;
    const title = document.createElement('h2');
    title.textContent = getDefinition(BALL_LOOKUP, id).name;
    section.append(title);
    const maxRadius = id === 'titan' ? 90 : 55;
    for (const [label, unit] of [
      ['phone size', PHONE],
      ['desktop size', DESKTOP],
    ] as const) {
      const heading = document.createElement('h3');
      heading.textContent = label;
      const table = document.createElement('div');
      table.className = 'cells';
      for (const tick of SAMPLES[id] ?? [0]) {
        const state = { ...timeline(tick), flash: 0 };
        const cell = document.createElement('div');
        cell.className = 'cell';
        for (const [which, design] of [
          ['old', old],
          ['new', fresh],
        ] as const) {
          const canvas = canvasFor(Math.ceil(maxRadius * 2 * unit + 8));
          canvas.dataset['which'] = which;
          paint(canvas, id, design, state, unit);
          cell.append(canvas);
        }
        const caption = document.createElement('p');
        caption.textContent = state.caption;
        cell.append(caption);
        table.append(cell);
      }
      section.append(heading, table);
    }
    root.append(section);
  }
}
