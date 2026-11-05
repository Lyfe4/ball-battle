import { drawBallIcon } from '../../render/ball-icon.ts';
import type { SeriesState } from '../../sim/series.ts';
import { scoreOf } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element, setText } from '../dom.ts';
import { roundLine, scoreLine, SIDE_NAMES } from '../series-text.ts';
import type { TrackCell, TrackColumn } from './series-view.ts';

export interface SeriesTrack {
  readonly element: HTMLElement;
  /** Draws the score and the rounds; cheap when nothing changed (it compares first). */
  update(state: SeriesState, columns: readonly TrackColumn[]): void;
}

const BALL_PX = 30;
const POOL_PX = 18;

/**
 * The series at a glance (ADR 0025): the score, then one column per round with the player's ball
 * over the bot's. A played round rings its winner and dims its loser; the round being played or
 * coming next is highlighted; a ball the player can't know yet is `?`; in Reveal the bot's unplayed
 * balls sit together until one is chosen. ↻ marks replays after draws and ⚡ sudden death. The
 * drawing is hidden from screen readers, which get the score and one sentence per round instead.
 */
export function createSeriesTrack(lookup: DefinitionLookup): SeriesTrack {
  const root = element('section', 'series-track');
  root.setAttribute('aria-label', 'Series');
  const score = element('p', 'series-track-score');
  const you = element('span', 'series-track-side', SIDE_NAMES.a);
  const points = element('span', 'series-track-points');
  const bot = element('span', 'series-track-side', SIDE_NAMES.b);
  score.append(you, points, bot);
  score.setAttribute('aria-hidden', 'true');
  const grid = element('div', 'series-track-grid');
  grid.setAttribute('aria-hidden', 'true');
  const spoken = element('ul', 'visually-hidden');
  root.append(score, grid, spoken);
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;

  /** `repeat`: the bot's ball in a mirror round, drawn lighter as in the arena. */
  function icon(id: string, px: number, repeat = false): HTMLCanvasElement {
    const canvas = element('canvas', 'series-track-icon');
    const ball = lookup.get(id);
    if (ball !== undefined) drawBallIcon(canvas, ball, px, repeat);
    return canvas;
  }

  function cell(content: TrackCell, repeat = false): HTMLElement {
    const node = element('span', 'series-track-cell');
    if (content.result !== undefined) node.dataset['result'] = content.result;
    if (content.ball !== undefined) node.append(icon(content.ball, BALL_PX, repeat));
    else if (content.pool !== undefined) {
      node.classList.add('series-track-pool');
      node.append(...content.pool.map((id) => icon(id, POOL_PX)));
    } else node.append(element('span', 'series-track-unknown', '?'));
    return node;
  }

  let shown = '';
  return {
    element: root,
    update(state, columns) {
      const { a, b } = scoreOf(state);
      const key = JSON.stringify([a, b, columns]);
      if (key === shown) return;
      shown = key;
      setText(points, `${String(a)} – ${String(b)}`);
      // Row by row in a grid of (label + one column per round): headers, You, Bot, markers.
      const rows = [
        [element('span', 'series-track-label', SIDE_NAMES.a), (c: TrackColumn) => cell(c.you)],
        [
          element('span', 'series-track-label', SIDE_NAMES.b),
          (c: TrackColumn) => cell(c.bot, c.bot.ball !== undefined && c.bot.ball === c.you.ball),
        ],
      ] as const;
      grid.replaceChildren(
        element('span', ''),
        ...columns.map((column) => {
          const head = element('span', 'series-track-round', `R${String(column.round + 1)}`);
          head.dataset['when'] = column.when;
          return head;
        }),
        ...rows.flatMap(([label, draw]) => [
          label,
          ...columns.map((column) => {
            const node = draw(column);
            node.dataset['when'] = column.when;
            return node;
          }),
        ]),
        element('span', ''),
        ...columns.map((column) => {
          const marks = element('span', 'series-track-marks');
          if (column.draws > 0) setText(marks, `↻${column.draws > 1 ? String(column.draws) : ''}`);
          if (column.suddenDeath) setText(marks, '⚡');
          return marks;
        }),
      );
      grid.style.setProperty('--rounds', String(columns.length));
      spoken.replaceChildren(
        element('li', '', scoreLine(state)),
        ...state.rounds.map((record) => element('li', '', roundLine(record, nameOf))),
      );
    },
  };
}
