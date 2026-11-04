import type { Matchup } from '../app/matchup.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { gridMove } from './grid-nav.ts';

export interface Picker {
  /** Shows a matchup in the slots, e.g. after loading one from the URL. */
  show(matchup: Matchup): void;
}

type Slot = 'a' | 'b';

/** Icon sizes in CSS pixels. */
const SLOT_ICON_PX = 36;
const CARD_ICON_PX = 48;

const SLOT_LABELS: Readonly<Record<Slot, string>> = { a: 'Ball A', b: 'Ball B' };

/**
 * Choosing the two balls, built to scale to a large roster. Each slot is a button showing its
 * ball; it opens a dialog with a grid of every ball (the real ball drawing, name and one-line
 * description). Arrow keys, Home and End move through the grid, Enter or Space picks, Escape
 * closes. Picking does nothing until Start match is pressed, so a misclick never wipes out a
 * fight in progress.
 */
export function createPicker(
  form: HTMLFormElement,
  balls: readonly BallDefinition[],
  onStart: (matchup: Matchup) => void,
): Picker {
  form.replaceChildren();
  form.className = 'picker';
  const first = balls[0];
  if (first === undefined) throw new Error('The picker needs at least one ball');
  const picks: Record<Slot, string> = { a: first.id, b: (balls[1] ?? first).id };
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  let openSlot: Slot = 'a';

  // The two slots and Start.
  const slotRow = element('div', 'picker-slots');
  const slotButtons = new Map<
    Slot,
    { button: HTMLButtonElement; icon: HTMLCanvasElement; name: HTMLElement }
  >();
  for (const slot of ['a', 'b'] as const) {
    const button = element('button', 'picker-slot');
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    const icon = element('canvas', 'picker-slot-icon');
    icon.setAttribute('aria-hidden', 'true');
    const text = element('span', 'picker-slot-text');
    const name = element('span', 'picker-slot-name');
    text.append(element('span', 'picker-slot-label', SLOT_LABELS[slot]), name);
    button.append(icon, text);
    button.addEventListener('click', () => {
      open(slot);
    });
    slotButtons.set(slot, { button, icon, name });
    slotRow.append(button);
  }
  const start = element('button', 'hud-button hud-button-primary picker-start', 'Start match');
  start.type = 'submit';
  form.append(slotRow, start);

  // The dialog with every ball.
  const dialog = element('dialog', 'picker-dialog');
  const titleId = 'picker-dialog-title';
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
  const cards = balls.map((ball) => {
    const card = element('button', 'picker-card');
    card.type = 'button';
    card.dataset['ballId'] = ball.id;
    const icon = element('canvas', 'picker-card-icon');
    icon.setAttribute('aria-hidden', 'true');
    drawBallIcon(icon, ball, CARD_ICON_PX);
    const text = element('span', 'picker-card-text');
    text.append(
      element('span', 'picker-card-name', ball.name),
      element('span', 'picker-card-description', ball.description),
    );
    card.append(icon, text);
    card.addEventListener('click', () => {
      pick(ball.id);
    });
    return card;
  });
  grid.append(...cards);
  dialog.append(header, grid);
  form.append(dialog);

  // A click on the backdrop (the dialog itself, outside its content) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    slotButtons.get(openSlot)?.button.focus();
  });
  grid.addEventListener('keydown', (event) => {
    const index = cards.findIndex((card) => card === document.activeElement);
    if (index < 0) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const next = gridMove(index, event.key, cards.length, columns);
    if (next === undefined) return;
    event.preventDefault();
    focusCard(next);
  });

  /** Roving focus: only one card is in the tab order, so Tab leaves the grid in one step. */
  function focusCard(index: number): void {
    cards.forEach((card, i) => {
      card.tabIndex = i === index ? 0 : -1;
    });
    cards[index]?.focus();
  }

  function open(slot: Slot): void {
    openSlot = slot;
    title.textContent = `Choose ${SLOT_LABELS[slot].replace('Ball', 'ball')}`;
    const current = cards.findIndex((card) => card.dataset['ballId'] === picks[slot]);
    cards.forEach((card, i) => {
      card.setAttribute('aria-pressed', String(i === current));
    });
    dialog.showModal();
    focusCard(Math.max(0, current));
  }

  function pick(id: string): void {
    picks[openSlot] = id;
    render();
    dialog.close();
  }

  function render(): void {
    for (const slot of ['a', 'b'] as const) {
      const parts = slotButtons.get(slot);
      const ball = byId.get(picks[slot]);
      if (parts === undefined || ball === undefined) continue;
      setText(parts.name, ball.name);
      parts.button.setAttribute('aria-label', `${SLOT_LABELS[slot]}: ${ball.name}. Change`);
      // Ball B in a mirror match is drawn lighter, as in the arena and the HUD.
      drawBallIcon(parts.icon, ball, SLOT_ICON_PX, slot === 'b' && picks.a === picks.b);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart({ a: picks.a, b: picks.b });
  });

  render();
  return {
    show(matchup) {
      if (byId.has(matchup.a)) picks.a = matchup.a;
      if (byId.has(matchup.b)) picks.b = matchup.b;
      render();
    },
  };
}
