import type { Matchup } from '../app/matchup.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createBallDialog } from './ball-dialog.ts';
import { element, setText } from './dom.ts';

export interface Picker {
  /** Shows a matchup in the slots, e.g. after loading one from the URL. */
  show(matchup: Matchup): void;
  /** True while the ball dialog is open (the game pauses the match meanwhile). */
  isOpen(): boolean;
}

type Slot = 'a' | 'b';

/** Icon size in a slot, in CSS pixels. */
const SLOT_ICON_PX = 36;

const SLOT_LABELS: Readonly<Record<Slot, string>> = { a: 'Ball A', b: 'Ball B' };

/**
 * Choosing the two balls for a quick match, built to scale to a large roster. Each slot is a
 * button showing its ball; it opens the ball dialog (ball-dialog.ts). Picking does nothing until
 * Start match is pressed, so a misclick never wipes out a fight in progress.
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

  const dialog = createBallDialog(form, balls, 'picker-dialog');

  function open(slot: Slot): void {
    dialog.open({
      title: `Choose ${SLOT_LABELS[slot].replace('Ball', 'ball')}`,
      pressed: [picks[slot]],
      onPick: (id) => {
        picks[slot] = id;
        render();
        dialog.close();
      },
      onClose: () => {
        slotButtons.get(slot)?.button.focus();
      },
    });
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
    isOpen: () => dialog.isOpen(),
    show(matchup) {
      if (byId.has(matchup.a)) picks.a = matchup.a;
      if (byId.has(matchup.b)) picks.b = matchup.b;
      render();
    },
  };
}
