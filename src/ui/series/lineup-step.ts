import { drawBallIcon } from '../../render/ball-icon.ts';
import { LINEUP_SIZE, type Format, type Lineup } from '../../sim/series.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { element, setText } from '../dom.ts';
import {
  completeLineup,
  draftCount,
  draftOf,
  removeFromDraft,
  toggleInDraft,
  type Draft,
} from '../lineup-draft.ts';
import { createScreenHeader } from '../screen-header.ts';

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
  /** The tray changed, so the setup keeps it if the player leaves for the manual and comes back. */
  readonly onChange: (draft: Draft) => void;
}

const TRAY_ICON_PX = 36;

/**
 * Picking three balls for a series, phone first and showing little (ADR 0025): a tray of three
 * slots on top (numbered where the order is set now, not in Reveal), the shared ball grid, and one
 * button to go on. A tap on a ball fills the next empty slot (the
 * order of taps is the order they play). A tap on a filled slot, or on that ball's tile in the grid
 * (marked "Slot N ✕"), takes it out and leaves the slot empty for the next pick, so a swap keeps
 * the order. The rules of a draft are in lineup-draft.ts.
 */
export function createLineupStep(
  balls: readonly BallDefinition[],
  actions: LineupActions,
): LineupStep {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const root = element('section', 'series-step lineup-step');
  const header = createScreenHeader('Your lineup', 'Back', actions.onBack);
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

  const grid = createBallGrid(balls, {
    label: 'Balls',
    onPick: (id) => {
      // In the tray already: the tap takes it out (as a tap on its slot does).
      const adding = !draft.includes(id);
      update(toggleInDraft(draft, id));
      if (adding && completeLineup(draft) !== undefined) done.focus();
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
  root.append(header.element, tray, grid.element, footer);

  function update(next: Draft): void {
    draft = next;
    actions.onChange(draft);
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
    const inTray = draft.flatMap((id, index) =>
      id === undefined ? [] : [[id, index + 1] as const],
    );
    grid.update({
      pressed: inTray.map(([id]) => id),
      notes: new Map(
        inTray.map(([id, slot]) => [
          id,
          // Reveal sets no order here (no slot numbers), so its note is the ✕ alone.
          format === 'reveal'
            ? { shown: '✕', spoken: 'in your lineup, tap to take out' }
            : {
                shown: `Slot ${String(slot)} ✕`,
                spoken: `in slot ${String(slot)}, tap to take out`,
              },
        ]),
      ),
    });
    const complete = completeLineup(draft) !== undefined;
    done.disabled = !complete;
    setText(
      done,
      complete
        ? format === 'reveal'
          ? 'Reveal lineups'
          : 'Start series'
        : `Pick ${String(LINEUP_SIZE - draftCount(draft))} more`,
    );
  }

  return {
    element: root,
    open(nextFormat, nextDraft) {
      format = nextFormat;
      // In Reveal the order isn't set here (the sides take turns showing), so no numbers.
      tray.classList.toggle('lineup-tray-unordered', format === 'reveal');
      update(draftOf(nextDraft, (id) => byId.has(id)));
      header.focus();
    },
    draft: () => draft,
  };
}
