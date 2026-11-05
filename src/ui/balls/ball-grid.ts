import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { element, setText } from '../dom.ts';
import { gridMove } from '../grid-nav.ts';
import type { Lean } from './matchups.ts';

/** Drawing size on a tile, in CSS pixels: big enough that the designs carry the tile. */
const TILE_ICON_PX = 56;

const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '' };

export interface BallGridState {
  /** Tiles shown as chosen (aria-pressed). */
  readonly pressed: readonly string[];
  /** Tiles that can't be picked, each with a short note shown on it (e.g. "In slot 2"). */
  readonly unavailable?: ReadonlyMap<string, string>;
  /** ▲ or ▼ on each tile for how it fares against `against` (quick match only). */
  readonly marks?: { readonly against: string; readonly leans: ReadonlyMap<string, Lean> };
}

export interface BallGrid {
  readonly element: HTMLElement;
  update(state: BallGridState): void;
  /** Moves focus into the grid: to `id`, else the first pressed tile, else the first available. */
  focus(id?: string): void;
}

export interface BallGridOptions {
  /** Names the group for screen readers, e.g. "Balls". */
  readonly label: string;
  readonly onPick: (id: string) => void;
  /** A tile got focus or the pointer: the info card follows it. */
  readonly onLook?: (id: string) => void;
}

/**
 * Every ball as a tile: the real drawing, large, and the name, no description (the info card
 * holds that), so the whole roster fits on a phone screen without scrolling or clipping. Tiles are
 * buttons in a group with roving focus: arrows, Home and End move, Enter or Space picks, Tab leaves
 * the grid in one step (ADR 0011). Shared by the quick-match setup, the lineup and the manual.
 */
export function createBallGrid(
  balls: readonly BallDefinition[],
  options: BallGridOptions,
): BallGrid {
  const grid = element('div', 'ball-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', options.label);
  let state: BallGridState = { pressed: [] };

  const tiles = balls.map((ball) => {
    const tile = element('button', 'ball-tile');
    tile.type = 'button';
    tile.dataset['ballId'] = ball.id;
    const icon = element('canvas', 'ball-tile-icon');
    icon.setAttribute('aria-hidden', 'true');
    drawBallIcon(icon, ball, TILE_ICON_PX);
    const mark = element('span', 'ball-tile-mark');
    mark.setAttribute('aria-hidden', 'true');
    const note = element('span', 'ball-tile-note');
    tile.append(mark, icon, element('span', 'ball-tile-name', ball.name), note);
    tile.addEventListener('click', () => {
      if (tile.getAttribute('aria-disabled') === 'true') return;
      options.onPick(ball.id);
    });
    tile.addEventListener('focus', () => options.onLook?.(ball.id));
    tile.addEventListener('pointerenter', () => options.onLook?.(ball.id));
    return { tile, mark, note, ball };
  });
  grid.append(...tiles.map(({ tile }) => tile));

  grid.addEventListener('keydown', (event) => {
    const index = tiles.findIndex(({ tile }) => tile === document.activeElement);
    if (index < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const next = gridMove(index, event.key, tiles.length, columns);
    if (next === undefined) return;
    event.preventDefault();
    focusTile(next);
  });

  /** Roving focus: only one tile is in the tab order, so Tab leaves the grid in one step. */
  function rove(index: number): void {
    tiles.forEach(({ tile }, i) => {
      tile.tabIndex = i === index ? 0 : -1;
    });
  }

  function focusTile(index: number): void {
    rove(index);
    tiles[index]?.tile.focus();
  }

  /** The tile that should hold the tab stop: the first pressed, else the first available. */
  function homeIndex(): number {
    const pressed = tiles.findIndex(({ ball }) => state.pressed.includes(ball.id));
    if (pressed >= 0) return pressed;
    return Math.max(
      0,
      tiles.findIndex(({ ball }) => state.unavailable?.has(ball.id) !== true),
    );
  }

  function update(next: BallGridState): void {
    state = next;
    for (const { tile, mark, note, ball } of tiles) {
      tile.setAttribute('aria-pressed', String(next.pressed.includes(ball.id)));
      const reason = next.unavailable?.get(ball.id);
      if (reason === undefined) tile.removeAttribute('aria-disabled');
      else tile.setAttribute('aria-disabled', 'true');
      setText(note, reason ?? '');
      const lean = next.marks?.leans.get(ball.id) ?? 'even';
      setText(mark, MARKS[lean]);
      mark.dataset['lean'] = lean;
      const against =
        next.marks === undefined || lean === 'even'
          ? ''
          : `, ${lean} against ${next.marks.against}`;
      tile.setAttribute(
        'aria-label',
        `${ball.name}${against}${reason === undefined ? '' : `, ${reason}`}`,
      );
    }
    // Keep the tab stop where focus is; otherwise put it on the chosen tile.
    const focused = tiles.findIndex(({ tile }) => tile === document.activeElement);
    rove(focused >= 0 ? focused : homeIndex());
  }

  update(state);
  return {
    element: grid,
    update,
    focus(id) {
      const wanted = tiles.findIndex(({ ball }) => ball.id === id);
      focusTile(wanted >= 0 ? wanted : homeIndex());
    },
  };
}
