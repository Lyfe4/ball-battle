import { drawBallIcon } from '../render/ball-icon.ts';
import { LINEUP_SIZE, type Lineup } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createBallDialog } from './ball-dialog.ts';
import { element, setText } from './dom.ts';
import {
  addToDraft,
  completeLineup,
  moveInDraft,
  removeFromDraft,
  type Draft,
} from './lineup-draft.ts';

export interface LineupBuilder {
  /** Shows or hides the builder (it is only for best-of-3 mode, before a series). */
  setVisible(visible: boolean): void;
  /** Replaces the lineup, e.g. one read from the URL or kept from the last series. */
  show(draft: Draft): void;
  /** True while the ball dialog is open (the game pauses meanwhile). */
  isOpen(): boolean;
}

const SLOT_ICON_PX = 32;

/**
 * Building a lineup for a best-of-3 series: three ordered slots, filled by tapping balls in the
 * shared ball dialog (each tap fills the next empty slot; a ball already picked can't be picked
 * again). Each slot can move up or down or be removed, Clear empties all three, and Start series
 * is enabled once all three are filled. Plain DOM; the rules live in lineup-draft.ts.
 */
export function createLineupBuilder(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  onStart: (lineup: Lineup) => void,
): LineupBuilder {
  root.replaceChildren();
  root.className = 'lineup';
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  let draft: Draft = [];

  const headingId = 'lineup-heading';
  root.setAttribute('aria-labelledby', headingId);
  const heading = element('h2', 'lineup-heading', 'Your lineup');
  heading.id = headingId;
  const hint = element(
    'p',
    'lineup-hint',
    'Pick 3 different balls in order. Round 1 is your first against the bot’s first; first to 2 wins. The bot’s lineup stays hidden.',
  );

  const list = element('ol', 'lineup-slots');
  const slots = Array.from({ length: LINEUP_SIZE }, (_, index) => {
    const item = element('li', 'lineup-slot');
    const number = element('span', 'lineup-slot-number', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    const icon = element('canvas', 'lineup-slot-icon');
    icon.setAttribute('aria-hidden', 'true');
    const name = element('span', 'lineup-slot-name');
    const up = iconButton('↑', () => {
      update(moveInDraft(draft, index, -1));
    });
    const down = iconButton('↓', () => {
      update(moveInDraft(draft, index, 1));
    });
    const remove = iconButton('✕', () => {
      update(removeFromDraft(draft, index));
    });
    item.append(number, icon, name, up, down, remove);
    list.append(item);
    return { icon, name, up, down, remove };
  });

  const actions = element('div', 'lineup-actions');
  const choose = element('button', 'hud-button', 'Choose balls');
  choose.type = 'button';
  choose.setAttribute('aria-haspopup', 'dialog');
  const clear = element('button', 'hud-button', 'Clear');
  clear.type = 'button';
  actions.append(choose, clear);
  const start = element('button', 'hud-button hud-button-primary', 'Start series');
  start.type = 'button';
  root.append(heading, hint, list, actions, start);

  const dialog = createBallDialog(root, balls, 'lineup-dialog');

  function iconButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = element('button', 'lineup-slot-button', text);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  /** What the dialog shows: the slot being filled, and which balls are already taken. */
  function dialogView() {
    const unavailable = new Map(draft.map((id, index) => [id, `In slot ${String(index + 1)}`]));
    return {
      title: `Choose ball ${String(Math.min(draft.length + 1, LINEUP_SIZE))} of ${String(LINEUP_SIZE)}`,
      pressed: draft,
      unavailable,
    };
  }

  choose.addEventListener('click', () => {
    dialog.open({
      ...dialogView(),
      onPick: (id) => {
        update(addToDraft(draft, id));
        if (completeLineup(draft) === undefined) dialog.refresh(dialogView());
        else dialog.close();
      },
      onClose: () => {
        (completeLineup(draft) === undefined ? choose : start).focus();
      },
    });
  });
  clear.addEventListener('click', () => {
    update([]);
  });
  start.addEventListener('click', () => {
    const lineup = completeLineup(draft);
    if (lineup !== undefined) onStart(lineup);
  });

  function update(next: Draft): void {
    draft = next;
    slots.forEach((slot, index) => {
      const id = draft[index];
      const ball = id === undefined ? undefined : byId.get(id);
      const label = ball?.name ?? 'Empty';
      setText(slot.name, label);
      slot.name.classList.toggle('lineup-slot-empty', ball === undefined);
      slot.icon.hidden = ball === undefined;
      if (ball !== undefined) drawBallIcon(slot.icon, ball, SLOT_ICON_PX);
      slot.up.disabled = ball === undefined || index === 0;
      slot.down.disabled = ball === undefined || index >= draft.length - 1;
      slot.remove.disabled = ball === undefined;
      slot.up.setAttribute('aria-label', `Move ${label} up`);
      slot.down.setAttribute('aria-label', `Move ${label} down`);
      slot.remove.setAttribute('aria-label', `Remove ${label}`);
    });
    const complete = completeLineup(draft) !== undefined;
    start.disabled = !complete;
    choose.disabled = complete;
    clear.disabled = draft.length === 0;
    // A control that just disabled itself (Clear, the last Remove, Move up at the top) would drop
    // keyboard focus to the page, so hand it to the next useful control.
    const focused = document.activeElement;
    if (focused instanceof HTMLButtonElement && focused.disabled && root.contains(focused)) {
      (complete ? start : choose).focus();
    }
  }

  update([]);
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(next) {
      update(next.filter((id) => byId.has(id)).reduce<Draft>(addToDraft, []));
    },
    isOpen: () => dialog.isOpen(),
  };
}
