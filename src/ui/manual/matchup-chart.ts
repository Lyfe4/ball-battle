import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { matchupLine } from '../balls/matchups.ts';
import { LEAN_WORDS, MARKS } from '../balls/marks.ts';
import { verdictOf } from '../balls/verdict.ts';
import { element, setText } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import { gridMove } from '../grid-nav.ts';

export interface MatchupChart {
  readonly element: HTMLElement;
}

/** Fits the smallest cell a phone gets (about 21 px for 14 balls at 375 px wide). */
const HEADER_ICON_PX = 18;

/**
 * The whole counter map at once, as a type chart: each row is a ball, each column an opponent, ▲
 * where the row's ball is favoured and ▼ where it isn't; even pairs are left blank so the counters
 * stand out. Focusing or tapping a cell highlights its row and column and says why, under the
 * chart. Cells are buttons with roving focus (arrow keys, Home, End), so Tab passes the chart in
 * one step. Cells shrink below 26 px when the roster needs it, so the whole chart fits a phone.
 */
export function createMatchupChart(
  balls: readonly BallDefinition[],
  onOpen: (id: string) => void,
): MatchupChart {
  const nameOf = (id: string) => balls.find((ball) => ball.id === id)?.name ?? id;
  const root = element('section', 'matchup-chart');
  // The header column plus one per ball; the CSS sizes cells so they all fit a phone.
  root.style.setProperty('--chart-columns', String(balls.length + 1));
  const scroller = element('div', 'matchup-chart-scroll');
  const table = element('table', 'matchup-table');
  const caption = element('caption', 'matchup-caption', 'Rows: each ball. Columns: its opponent.');
  table.append(caption);

  const icon = (ball: BallDefinition) => {
    const canvas = element('canvas', 'matchup-icon');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ball.name);
    drawBallIcon(canvas, ball, HEADER_ICON_PX);
    return canvas;
  };

  const head = element('thead', '');
  const headRow = element('tr', '');
  headRow.append(element('td', 'matchup-corner'));
  const columnHeads = balls.map((ball) => {
    const th = element('th', 'matchup-col');
    th.scope = 'col';
    th.append(icon(ball));
    headRow.append(th);
    return th;
  });
  head.append(headRow);

  const body = element('tbody', '');
  const cells: { button: HTMLButtonElement; row: number; col: number }[] = [];
  const rowHeads = balls.map((ball, row) => {
    const tr = element('tr', '');
    const th = element('th', 'matchup-row');
    th.scope = 'row';
    th.append(icon(ball));
    tr.append(th);
    balls.forEach((opponent, col) => {
      const td = element('td', 'matchup-cell');
      if (row === col) {
        td.classList.add('matchup-mirror');
        tr.append(td);
        return;
      }
      const { lean } = matchupLine(ball.id, opponent.id);
      const button = element('button', 'matchup-button', lean === 'even' ? '' : MARKS[lean]);
      button.type = 'button';
      button.dataset['lean'] = lean;
      markSymbol(button, lean === 'even' ? undefined : lean);
      button.setAttribute('aria-label', `${ball.name} ${LEAN_WORDS[lean]} ${opponent.name}`);
      button.addEventListener('focus', () => {
        select(row, col);
      });
      button.addEventListener('click', () => {
        select(row, col);
      });
      td.append(button);
      tr.append(td);
      cells.push({ button, row, col });
    });
    body.append(tr);
    return { tr, th };
  });
  table.append(head, body);
  scroller.append(table);

  const detail = element('section', 'matchup-detail');
  detail.setAttribute('aria-live', 'polite');
  const headline = element('h2', 'matchup-detail-headline');
  const reason = element('p', 'matchup-detail-reason');
  const open = element('button', 'hud-button matchup-open');
  open.type = 'button';
  let openId = '';
  open.addEventListener('click', () => {
    onOpen(openId);
  });
  detail.append(headline, reason, open);
  root.append(scroller, detail);

  /** Highlights a row and column, says why, and keeps the cell as the chart's one tab stop. */
  function select(row: number, col: number): void {
    const a = balls[row];
    const b = balls[col];
    if (a === undefined || b === undefined) return;
    rowHeads.forEach(({ tr }, i) => tr.classList.toggle('matchup-on', i === row));
    columnHeads.forEach((th, i) => th.classList.toggle('matchup-on', i === col));
    for (const cell of cells) {
      cell.button.classList.toggle('matchup-cross', cell.col === col || cell.row === row);
      cell.button.tabIndex = cell.row === row && cell.col === col ? 0 : -1;
    }
    const verdict = verdictOf(a.id, b.id, nameOf);
    setText(headline, `${a.name} vs ${b.name}: ${verdict.headline}`);
    setText(reason, verdict.reason);
    openId = a.id;
    setText(open, `Open ${a.name}`);
  }

  body.addEventListener('keydown', (event) => {
    const at = cells.findIndex(({ button }) => button === document.activeElement);
    const cell = cells[at];
    if (cell === undefined) return;
    // Move over the full grid, stepping once more over a mirror square (it has no button).
    const size = balls.length;
    const here = cell.row * size + cell.col;
    let next = gridMove(here, event.key, size * size, size);
    if (next === undefined) return;
    event.preventDefault();
    if (Math.floor(next / size) === next % size)
      next = gridMove(next, event.key, size * size, size);
    const target = cells.find((c) => c.row * size + c.col === next);
    target?.button.focus();
  });

  // The first counter in the map starts selected, so the chart opens with an example explained.
  const first = cells.find(({ button }) => button.dataset['lean'] === 'favoured') ?? cells[0];
  if (first !== undefined) select(first.row, first.col);
  return { element: root };
}
