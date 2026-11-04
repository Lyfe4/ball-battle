import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element } from './dom.ts';
import { gridMove } from './grid-nav.ts';

/** Icon size on a card, in CSS pixels. */
const CARD_ICON_PX = 48;

export interface BallDialogOptions {
  readonly title: string;
  /** Cards shown as selected (aria-pressed). Focus starts on the first. */
  readonly pressed: readonly string[];
  /** Cards that can't be picked, each with a short note shown on it (e.g. "In slot 2"). */
  readonly unavailable?: ReadonlyMap<string, string>;
  readonly onPick: (id: string) => void;
  /** Runs when the dialog closes, however it closes. */
  readonly onClose?: () => void;
}

export interface BallDialog {
  open(options: BallDialogOptions): void;
  /** Updates the title, selection and unavailable cards of the open dialog in place. */
  refresh(options: Omit<BallDialogOptions, 'onPick' | 'onClose'>): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * A modal dialog with a grid of every ball (the real ball drawing, name and one-line description),
 * shared by the quick-match picker and the lineup builder. Cards are buttons in a group with roving
 * focus: arrow keys, Home and End move, Enter or Space picks, Tab leaves the grid in one step,
 * Escape or the backdrop closes (ADR 0011).
 */
export function createBallDialog(
  parent: HTMLElement,
  balls: readonly BallDefinition[],
  idPrefix: string,
): BallDialog {
  const dialog = element('dialog', 'picker-dialog');
  const titleId = `${idPrefix}-title`;
  dialog.setAttribute('aria-labelledby', titleId);
  const header = element('div', 'picker-dialog-header');
  const title = element('h2', 'picker-dialog-title');
  title.id = titleId;
  const close = element('button', 'hud-button picker-dialog-close', 'Close');
  close.type = 'button';
  close.addEventListener('click', () => {
    dialog.close();
  });
  header.append(title, close);
  const grid = element('div', 'picker-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-labelledby', titleId);

  let current: BallDialogOptions | undefined;
  const cards = balls.map((ball) => {
    const card = element('button', 'picker-card');
    card.type = 'button';
    card.dataset['ballId'] = ball.id;
    const icon = element('canvas', 'picker-card-icon');
    icon.setAttribute('aria-hidden', 'true');
    drawBallIcon(icon, ball, CARD_ICON_PX);
    const text = element('span', 'picker-card-text');
    const note = element('span', 'picker-card-note');
    text.append(
      element('span', 'picker-card-name', ball.name),
      element('span', 'picker-card-description', ball.description),
      note,
    );
    card.append(icon, text);
    card.addEventListener('click', () => {
      if (card.getAttribute('aria-disabled') === 'true') return;
      current?.onPick(ball.id);
    });
    return { card, note, id: ball.id };
  });
  grid.append(...cards.map(({ card }) => card));
  dialog.append(header, grid);
  parent.append(dialog);

  // A click on the backdrop (the dialog itself, outside its content) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    const onClose = current?.onClose;
    current = undefined;
    onClose?.();
  });
  grid.addEventListener('keydown', (event) => {
    const index = cards.findIndex(({ card }) => card === document.activeElement);
    if (index < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const next = gridMove(index, event.key, cards.length, columns);
    if (next === undefined) return;
    event.preventDefault();
    focusCard(next);
  });

  /** Roving focus: only one card is in the tab order, so Tab leaves the grid in one step. */
  function focusCard(index: number): void {
    cards.forEach(({ card }, i) => {
      card.tabIndex = i === index ? 0 : -1;
    });
    cards[index]?.card.focus();
  }

  function show(options: Omit<BallDialogOptions, 'onPick' | 'onClose'>): void {
    title.textContent = options.title;
    for (const { card, note, id } of cards) {
      card.setAttribute('aria-pressed', String(options.pressed.includes(id)));
      const reason = options.unavailable?.get(id);
      if (reason === undefined) {
        card.removeAttribute('aria-disabled');
        note.textContent = '';
      } else {
        card.setAttribute('aria-disabled', 'true');
        note.textContent = reason;
      }
    }
  }

  return {
    open(options) {
      current = options;
      show(options);
      dialog.showModal();
      const first = cards.findIndex(({ id }) => id === options.pressed[0]);
      const available = cards.findIndex(({ id }) => options.unavailable?.has(id) !== true);
      focusCard(first >= 0 ? first : Math.max(0, available));
    },
    refresh(options) {
      if (current === undefined) return;
      const focused = cards.findIndex(({ card }) => card === document.activeElement);
      show(options);
      if (focused >= 0) focusCard(focused);
    },
    close() {
      if (dialog.open) dialog.close();
    },
    isOpen: () => dialog.open,
  };
}
