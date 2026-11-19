import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { createMatchupLegend } from '../balls/matchup-legend.ts';
import { leanOf, levelOf, matchupTip } from '../balls/matchups.ts';
import { element, setText } from '../dom.ts';

export interface MatchupOne {
  /** The heading row: the ball every tile is read against, and the way to change it. */
  readonly head: HTMLElement;
  /** The key and the grid of every ball. */
  readonly body: HTMLElement;
  /** Shows how `ball` does against `against`, every other ball read against `against` too. */
  show(ball: string, against: string): void;
}

const HEAD_ICON_PX = 32;

/**
 * The matchup chart on a phone (ADR 0073): 25 columns leave cells too small to read two levels,
 * so it shows one ball against all the others, in the quick setup's grid (the same tiles, marks and
 * key: each tile's mark is how that ball does against the chosen one). A tap on a tile explains the
 * pair; "Change ball" turns the grid into a chooser for the ball they are read against.
 */
export function createMatchupOne(
  balls: readonly BallDefinition[],
  onSelect: (ball: string, against: string) => void,
): MatchupOne {
  const nameOf = (id: string) => balls.find((ball) => ball.id === id)?.name ?? id;
  let current = { ball: balls[0]?.id ?? '', against: balls[1]?.id ?? '' };
  let choosing = false;

  const head = element('div', 'matchup-one-head');
  const icon = element('canvas', 'matchup-one-icon');
  icon.setAttribute('aria-hidden', 'true');
  const title = element('h2', 'matchup-one-title');
  const change = element('button', 'text-link matchup-one-change', 'Change ball');
  change.type = 'button';
  change.addEventListener('click', () => {
    choose(!choosing);
  });
  head.append(icon, title, change);

  // The quick setup's key: what the marks say, against the chosen ball's drawing.
  const legend = createMatchupLegend();

  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      if (choosing) {
        choosing = false;
        const ball = id === current.ball ? current.against : current.ball;
        onSelect(ball, id);
        return;
      }
      if (id !== current.against) onSelect(id, current.against);
    },
  });
  const body = element('div', 'matchup-one-body');
  body.append(legend.element, grid.element);

  function choose(on: boolean): void {
    choosing = on;
    render();
    if (on) grid.focus(current.against);
  }

  function render(): void {
    const { ball, against } = current;
    const target = balls.find((one) => one.id === against);
    if (target !== undefined) {
      drawBallIcon(icon, target, HEAD_ICON_PX);
      legend.show(target);
    }
    setText(title, choosing ? 'Choose a ball' : `Every ball vs ${nameOf(against)}`);
    setText(change, choosing ? 'Cancel' : 'Change ball');
    change.setAttribute('aria-expanded', String(choosing));
    legend.element.hidden = choosing;
    if (choosing) {
      grid.update({ pressed: [against] });
      return;
    }
    const others = balls.filter((one) => one.id !== against);
    grid.update({
      pressed: [ball],
      unavailable: new Map([[against, 'Itself']]),
      marks: {
        against: nameOf(against),
        leans: new Map(others.map((one) => [one.id, leanOf(one.id, against)])),
        levels: new Map(others.map((one) => [one.id, levelOf(one.id, against)])),
        tips: new Map(
          others.map((one) => [one.id, matchupTip(one.id, against, nameOf, 'neutral')]),
        ),
      },
    });
  }

  return {
    head,
    body,
    show(ball, against) {
      current = { ball, against };
      choosing = false;
      render();
    },
  };
}
