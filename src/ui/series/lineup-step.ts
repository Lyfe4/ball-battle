import { botChooses } from '../../app/modes.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import { LINEUP_SIZE, type Format, type Lineup } from '../../sim/series.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { createBallGrid } from '../balls/ball-grid.ts';
import { element, setText } from '../dom.ts';
import {
  completeLineup,
  draftCount,
  draftOf,
  emptySlotText,
  removeFromDraft,
  toggleInDraft,
  type Draft,
} from '../lineup-draft.ts';
import { setupLine } from '../modes-text.ts';
import { createScreenHeader } from '../screen-header.ts';
import { createLevelChoice } from './level-choice.ts';

export interface LineupStep {
  readonly element: HTMLElement;
  /**
   * Shows the lineup step for `format`, with `draft` in the tray and the bot's `level` (where it
   * makes choices), and focuses the heading.
   */
  open(format: Format, draft: Draft, level: string): void;
  /** The lineup in the tray, complete or not. */
  draft(): Draft;
}

export interface LineupActions {
  readonly onBack: () => void;
  /** Three balls are in the tray and the player goes on. */
  readonly onDone: (lineup: Lineup) => void;
  /** The tray changed, so the setup keeps it if the player leaves for the manual and comes back. */
  readonly onChange: (draft: Draft) => void;
  /** The player chose the bot's level here (ADR 0046), without leaving the step. */
  readonly onLevel: (level: string) => void;
}

const TRAY_ICON_PX = 36;

/**
 * Picking three balls for a series, phone first and showing little (ADR 0025): a tray of three
 * slots on top (numbered where the order is set now, not in Reveal), the shared ball grid, and one
 * button to go on. A tap on a ball fills the next empty slot (the
 * order of taps is the order they play). A tap on a filled slot, or on that ball's tile in the grid
 * (marked "Slot N ✕"), takes it out and leaves the slot empty for the next pick, so a swap keeps
 * the order. The rules of a draft are in lineup-draft.ts. Under the header, what the lineup is for
 * ("Best of 3 · Reveal") and the bot's level, changed in place (ADR 0046): home's one tap skips
 * the rules step, so this is where both are seen.
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

  const mode = element('div', 'lineup-mode');
  const modeName = element('p', 'lineup-mode-name');
  const level = createLevelChoice(actions.onLevel);
  mode.append(modeName, level.element);

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
  root.append(header.element, mode, tray, grid.element, footer);

  /** Reveal and Showdown pick each round's ball as they go, so the lineup has no order. */
  const unordered = () => format !== 'blind';

  function update(next: Draft): void {
    draft = next;
    actions.onChange(draft);
    slots.forEach((slot, index) => {
      const ball = byId.get(draft[index] ?? '');
      setText(slot.name, ball?.name ?? emptySlotText(index, !unordered()));
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
          // Reveal and Showdown set no order here (no slot numbers), so the note is the ✕ alone.
          unordered()
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
        ? unordered()
          ? 'Reveal lineups'
          : 'Start series'
        : `Pick ${String(LINEUP_SIZE - draftCount(draft))} more`,
    );
  }

  return {
    element: root,
    open(nextFormat, nextDraft, nextLevel) {
      format = nextFormat;
      setText(modeName, setupLine(format));
      // Blind has no choices a level changes (ADR 0035), so no level to show.
      level.element.hidden = !botChooses(format);
      level.show(nextLevel);
      // In Reveal the order isn't set here (the sides take turns showing), so no numbers.
      tray.classList.toggle('lineup-tray-unordered', unordered());
      update(draftOf(nextDraft, (id) => byId.has(id)));
      header.focus();
    },
    draft: () => draft,
  };
}
