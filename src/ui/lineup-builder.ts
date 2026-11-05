import { drawBallIcon } from '../render/ball-icon.ts';
import { FORMATS, LINEUP_SIZE, type Format, type Lineup } from '../sim/series.ts';
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
import { createSegmented } from './segmented.ts';
import { FORMAT_HINTS, FORMAT_NAMES, FORMAT_SHORT_NAMES } from './series-text.ts';

export interface LineupBuilder {
  /** Shows or hides the builder (it is only for best-of-3 mode, before a series). */
  setVisible(visible: boolean): void;
  /**
   * Back to building: replaces the lineup when given (e.g. one read from the URL or kept from the
   * last series), else keeps the one being built, and the format when given.
   */
  show(draft: Draft | undefined, format?: Format): void;
  /** Reveal, then order: both lineups are shown and the player sets the order of theirs. */
  showOrdering(own: Lineup, opponent: Lineup): void;
  /** The chosen format. */
  format(): Format;
  /** True while the ball dialog is open (the game pauses meanwhile). */
  isOpen(): boolean;
}

export interface LineupActions {
  /** The lineup is complete and the player starts (or, in reveal-then-order, reveals). */
  readonly onStart: (lineup: Lineup, format: Format) => void;
  /** Reveal, then order: the player locked the order of their lineup. */
  readonly onLockOrder: (lineup: Lineup) => void;
  /** The format choice changed. */
  readonly onFormat: (format: Format) => void;
}

const SLOT_ICON_PX = 32;

/**
 * Building a lineup for a best-of-3 series: the draft format (ADR 0019), then three ordered slots,
 * filled by tapping balls in the shared ball dialog (each tap fills the next empty slot; a ball
 * already picked can't be picked again). Each slot can move up or down or be removed, Clear empties
 * all three, and Start series is enabled once all three are filled. In reveal-then-order, Start
 * reveals both lineups and the builder switches to ordering: the bot's lineup is shown, only the
 * move buttons stay, and Lock order starts the series. Plain DOM; the rules live in
 * lineup-draft.ts.
 */
export function createLineupBuilder(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  actions: LineupActions,
  initialFormat: Format = 'blind',
): LineupBuilder {
  root.replaceChildren();
  root.className = 'lineup';
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  let draft: Draft = [];
  let format = initialFormat;
  let ordering = false;

  const formatRoot = element('div', 'lineup-format');
  const formatChoice = createSegmented<Format>(
    formatRoot,
    'lineup-format',
    'Rules',
    FORMATS.map((value) => ({
      value,
      text: FORMAT_SHORT_NAMES[value],
      label: FORMAT_NAMES[value],
    })),
    format,
    (next) => {
      format = next;
      actions.onFormat(next);
      update(draft);
    },
  );
  const headingId = 'lineup-heading';
  root.setAttribute('aria-labelledby', headingId);
  const heading = element('h2', 'lineup-heading', 'Your lineup');
  heading.id = headingId;
  const hint = element('p', 'lineup-hint');
  const opponentLabel = element('p', 'lineup-opponent-label', 'The bot’s lineup');
  opponentLabel.id = 'lineup-opponent-label';
  const opponent = element('ul', 'lineup-opponent');
  opponent.setAttribute('aria-labelledby', opponentLabel.id);
  const ownLabel = element('p', 'lineup-opponent-label', 'Your order');

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

  const buttons = element('div', 'lineup-actions');
  const choose = element('button', 'hud-button', 'Choose balls');
  choose.type = 'button';
  choose.setAttribute('aria-haspopup', 'dialog');
  const clear = element('button', 'hud-button', 'Clear');
  clear.type = 'button';
  buttons.append(choose, clear);
  const start = element('button', 'hud-button hud-button-primary', 'Start series');
  start.type = 'button';
  const back = element('button', 'hud-button', 'Change lineup');
  back.type = 'button';
  root.append(
    formatRoot,
    heading,
    hint,
    opponentLabel,
    opponent,
    ownLabel,
    list,
    buttons,
    start,
    back,
  );

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
    if (lineup === undefined) return;
    if (ordering) actions.onLockOrder(lineup);
    else actions.onStart(lineup, format);
  });
  back.addEventListener('click', () => {
    ordering = false;
    update(draft);
    choose.focus();
  });

  /** The bot's revealed lineup, shown while ordering (in roster order, so it gives nothing away). */
  function showOpponent(ids: readonly string[]): void {
    opponent.replaceChildren(
      ...ids.map((id) => {
        const ball = byId.get(id);
        const item = element('li', 'lineup-opponent-ball');
        const icon = element('canvas', 'lineup-slot-icon');
        icon.setAttribute('aria-hidden', 'true');
        if (ball !== undefined) drawBallIcon(icon, ball, SLOT_ICON_PX);
        item.append(icon, element('span', 'lineup-slot-name', ball?.name ?? id));
        return item;
      }),
    );
  }

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
      slot.remove.hidden = ordering;
      slot.up.setAttribute('aria-label', `Move ${label} up`);
      slot.down.setAttribute('aria-label', `Move ${label} down`);
      slot.remove.setAttribute('aria-label', `Remove ${label}`);
    });
    const complete = completeLineup(draft) !== undefined;
    formatRoot.hidden = ordering;
    buttons.hidden = ordering;
    opponent.hidden = !ordering;
    opponentLabel.hidden = !ordering;
    ownLabel.hidden = !ordering;
    back.hidden = !ordering;
    setText(heading, ordering ? 'Set your order' : 'Your lineup');
    setText(
      hint,
      ordering
        ? 'Both lineups are revealed. Order yours; the bot orders its own in secret.'
        : FORMAT_HINTS[format],
    );
    setText(
      start,
      ordering ? 'Lock order' : format === 'reveal' ? 'Reveal lineups' : 'Start series',
    );
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
    show(next, nextFormat) {
      ordering = false;
      if (nextFormat !== undefined) {
        format = nextFormat;
        formatChoice.select(nextFormat);
      }
      const kept = next ?? draft;
      update(kept.filter((id) => byId.has(id)).reduce<Draft>(addToDraft, []));
    },
    showOrdering(own, revealed) {
      ordering = true;
      const roster = balls.map((ball) => ball.id);
      showOpponent([...revealed].sort((x, y) => roster.indexOf(x) - roster.indexOf(y)));
      update(own);
      start.focus();
    },
    format: () => format,
    isOpen: () => dialog.isOpen(),
  };
}
