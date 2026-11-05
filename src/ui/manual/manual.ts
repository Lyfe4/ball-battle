import type { Matchup } from '../../app/matchup.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { element, setText } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { createSegmented } from '../segmented.ts';
import { createMatchupChart } from './matchup-chart.ts';
import { createBallDetail } from './ball-detail.ts';

export interface ManualActions {
  readonly onBack: () => void;
  /** A ball's entry: from the roster, from a matchup, or from ‹ ›. */
  readonly onOpen: (id: string, how: 'push' | 'replace') => void;
  /** The index's tab: the roster or the matchup chart. */
  readonly onTab: (chart: boolean) => void;
  readonly onTry: (matchup: Matchup) => void;
}

export interface Manual {
  setVisible(visible: boolean): void;
  /** The roster or the chart, or one ball's entry; focus goes to the heading. */
  show(ball: string | undefined, chart: boolean): void;
}

/**
 * The ball manual, phone first: the roster as the shared ball grid, and one entry per ball (its
 * detail) with the previous and next balls at its foot, to step through the roster in order. Everything comes from the definitions and
 * the counter map, so it can't go stale.
 */
export function createManual(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  actions: ManualActions,
): Manual {
  root.replaceChildren();
  root.classList.add('manual');
  const roster = balls.map((ball) => ball.id);
  const header = createScreenHeader('Ball manual', 'Back', actions.onBack);

  const index = element('section', 'manual-index');
  const intro = element(
    'p',
    'series-step-hint',
    'Every ball: what it does, and who it beats and loses to. A counter is favoured, never certain.',
  );
  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      actions.onOpen(id, 'push');
    },
  });
  const tabRoot = element('div', 'manual-tabs');
  const tabs = createSegmented<boolean>(
    tabRoot,
    'manual-tab',
    'Show',
    [
      { value: false, text: 'Balls' },
      { value: true, text: 'Matchup chart' },
    ],
    false,
    (chart) => {
      actions.onTab(chart);
    },
  );
  const chart = createMatchupChart(balls, (id) => {
    actions.onOpen(id, 'push');
  });
  index.append(tabRoot, intro, grid.element, chart.element);

  const entry = element('section', 'manual-entry');
  const steps = element('div', 'manual-steps');
  const previous = element('button', 'hud-button manual-step');
  previous.type = 'button';
  const next = element('button', 'hud-button manual-step');
  next.type = 'button';
  steps.append(previous, next);
  let current: string | undefined;
  const step = (by: -1 | 1) => () => {
    const at = roster.indexOf(current ?? '');
    const id = roster[(at + by + roster.length) % roster.length];
    if (id !== undefined) actions.onOpen(id, 'replace');
  };
  previous.addEventListener('click', step(-1));
  next.addEventListener('click', step(1));
  const detail = createBallDetail(balls, {
    onOpen: (id) => {
      actions.onOpen(id, 'push');
    },
    onTry: actions.onTry,
  });
  entry.append(detail.element, steps);

  root.append(header.element, index, entry);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(ball, showChart) {
      current = ball;
      tabs.select(showChart);
      grid.element.hidden = showChart;
      chart.element.hidden = !showChart;
      index.hidden = ball !== undefined;
      entry.hidden = ball === undefined;
      const name = balls.find((b) => b.id === ball)?.name;
      header.setTitle(name ?? 'Ball manual');
      if (ball !== undefined) {
        detail.show(ball);
        const at = roster.indexOf(ball);
        const nameAt = (i: number) => balls[(i + roster.length) % roster.length]?.name ?? '';
        // The neighbours by name, so stepping through the roster says where it goes.
        setText(previous, `‹ ${nameAt(at - 1)}`);
        setText(next, `${nameAt(at + 1)} ›`);
        previous.setAttribute('aria-label', `Previous ball: ${nameAt(at - 1)}`);
        next.setAttribute('aria-label', `Next ball: ${nameAt(at + 1)}`);
      } else {
        grid.update({ pressed: [] });
      }
      header.focus();
    },
  };
}
