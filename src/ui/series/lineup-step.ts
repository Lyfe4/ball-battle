import { drawBallIcon } from '../../render/ball-icon.ts';
import { LINEUP_SIZE, type Format, type Lineup } from '../../sim/series.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { createBallInfo } from '../balls/ball-info.ts';
import { element, setText } from '../dom.ts';
import { addToDraft, completeLineup, removeFromDraft, type Draft } from '../lineup-draft.ts';
import { createScreenHeader } from '../screen-header.ts';
import { FORMAT_NAMES, LINEUP_HINTS } from '../series-text.ts';

export interface LineupStep {
  readonly element: HTMLElement;
  /** Shows the lineup step for `format`, with `draft` in the tray, and focuses the heading. */
  open(format: Format, draft: Draft): void;
  /** The lineup in the tray, complete or not. */
  draft(): Draft;
}

export interface LineupActions {
  readonly onBack: () => void;
  /** Three balls are in the tray and the player goes on. */
  readonly onDone: (lineup: Lineup) => void;
}

const TRAY_ICON_PX = 36;

/**
 * Picking three balls for a series, phone first: a tray of three numbered slots on top, the info
 * card, the shared ball grid, and one button to go on. A tap on a ball fills the next empty slot (the
 * order of taps is the order they play); a tap on a filled slot takes its ball out, and the balls
 * after it move up. Balls already in the tray show "In slot N" and can't be picked twice. The rules
 * of a draft are in lineup-draft.ts.
 */
export function createLineupStep(
  balls: readonly BallDefinition[],
  actions: LineupActions,
): LineupStep {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const root = element('section', 'series-step lineup-step');
  const header = createScreenHeader('Your lineup', 'Back', actions.onBack);
  const hint = element('p', 'series-step-hint');
  let draft: Draft = [];
  let format: Format = 'blind';

  const tray = element('ol', 'lineup-tray');
  tray.setAttribute('aria-label', 'Your lineup');
  const slots = Array.from({ length: LINEUP_SIZE }, (_, index) => {
    const item = element('li', 'lineup-tray-item');
    const button = element('button', 'lineup-tray-slot');
    button.type = 'button';
    const number = element('span', 'lineup-tray-number', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    const icon = element('canvas', 'lineup-tray-icon');
    icon.setAttribute('aria-hidden', 'true');
    const name = element('span', 'lineup-tray-name');
    button.append(number, icon, name);
    button.addEventListener('click', () => {
      if (draft[index] === undefined) return;
      update(removeFromDraft(draft, index));
      // The slot may now be empty: keep focus on it so the keyboard user stays in the tray.
      button.focus();
    });
    item.append(button);
    tray.append(item);
    return { button, icon, name };
  });

  const info = createBallInfo(balls);
  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      info.show(id);
      update(addToDraft(draft, id));
      if (completeLineup(draft) !== undefined) done.focus();
    },
    onLook: (id) => {
      info.show(id);
    },
  });

  const done = element('button', 'hud-button hud-button-primary');
  done.type = 'button';
  done.addEventListener('click', () => {
    const lineup = completeLineup(draft);
    if (lineup !== undefined) actions.onDone(lineup);
  });
  const footer = element('div', 'screen-footer');
  footer.append(done);
  root.append(header.element, hint, tray, info.element, grid.element, footer);

  function update(next: Draft): void {
    draft = next;
    slots.forEach((slot, index) => {
      const ball = byId.get(draft[index] ?? '');
      setText(slot.name, ball?.name ?? 'Empty');
      slot.button.classList.toggle('lineup-tray-empty', ball === undefined);
      slot.icon.hidden = ball === undefined;
      if (ball !== undefined) drawBallIcon(slot.icon, ball, TRAY_ICON_PX);
      slot.button.setAttribute(
        'aria-label',
        ball === undefined
          ? `Slot ${String(index + 1)}: empty`
          : `Slot ${String(index + 1)}: ${ball.name}. Take out`,
      );
    });
    grid.update({
      pressed: draft,
      unavailable: new Map(draft.map((id, index) => [id, `In slot ${String(index + 1)}`])),
    });
    const complete = completeLineup(draft) !== undefined;
    done.disabled = !complete;
    setText(
      done,
      complete
        ? format === 'reveal'
          ? 'Reveal lineups'
          : 'Start series'
        : `Pick ${String(LINEUP_SIZE - draft.length)} more`,
    );
  }

  return {
    element: root,
    open(nextFormat, nextDraft) {
      format = nextFormat;
      setText(hint, `${FORMAT_NAMES[format]}. ${LINEUP_HINTS[format]}`);
      update(nextDraft.filter((id) => byId.has(id)).reduce<Draft>(addToDraft, []));
      info.show(draft[0] ?? balls[0]?.id ?? '');
      header.focus();
    },
    draft: () => draft,
  };
}
