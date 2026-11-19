// PROTOTYPE ONLY (proto/ball-looks-2): every state of each ball at once, old above new, at phone and
// desktop size: the gallery's ?strips view, and the source of the proposal's screenshots.
import type { Entry } from './entries.ts';
import type { BallDesign } from '../render/ball-designs/types.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { TIMELINES, type GalleryState } from './timelines.ts';

const PHONE = 340 / 1016;
const DESKTOP = 720 / 1016;

export function renderStrips(
  root: HTMLElement,
  entries: readonly Entry[],
  paint: (
    canvas: HTMLCanvasElement,
    id: string,
    design: BallDesign,
    state: GalleryState,
    unit: number,
  ) => void,
  canvasFor: (cssSize: number) => HTMLCanvasElement,
): void {
  for (const { id, old, looks } of entries) {
    const timeline = TIMELINES[id];
    if (timeline === undefined) continue;
    const section = document.createElement('section');
    section.className = 'strip';
    section.id = `strip-${id}`;
    const title = document.createElement('h2');
    title.textContent = getDefinition(BALL_LOOKUP, id).name;
    section.append(title);
    const maxRadius = 55;
    for (const [label, unit] of [
      ['phone size', PHONE],
      ['desktop size', DESKTOP],
    ] as const) {
      const heading = document.createElement('h3');
      heading.textContent = label;
      const table = document.createElement('div');
      table.className = 'cells';
      for (const tick of timeline.samples) {
        const state = { ...timeline.at(tick), flash: 0 };
        const cell = document.createElement('div');
        cell.className = 'cell';
        for (const [which, design] of [
          ['old', old] as const,
          ...looks.map((look) => [look.label, look.design] as const),
        ]) {
          const canvas = canvasFor(Math.ceil(maxRadius * 2 * unit + 8));
          paint(canvas, id, design, state, unit);
          const label = document.createElement('span');
          label.className = 'which';
          label.textContent = which;
          cell.append(canvas, label);
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
