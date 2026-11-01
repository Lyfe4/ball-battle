import type { Matchup } from '../app/matchup.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element } from './dom.ts';

export interface Picker {
  /** Shows a matchup in the selects, e.g. after loading one from the URL. */
  show(matchup: Matchup): void;
}

/**
 * A plain-DOM form to choose the two balls. Changing a select does nothing until Start match is
 * pressed, so a misclick never wipes out a fight in progress.
 */
export function createPicker(
  form: HTMLFormElement,
  balls: readonly BallDefinition[],
  onStart: (matchup: Matchup) => void,
): Picker {
  form.replaceChildren();
  form.className = 'picker';

  const select = (slot: 'a' | 'b', label: string): HTMLSelectElement => {
    const id = `picker-${slot}`;
    const field = element('div', 'picker-field');
    const labelElement = element('label', 'picker-label', label);
    labelElement.htmlFor = id;
    const control = element('select', 'picker-select');
    control.id = id;
    control.name = slot;
    for (const ball of balls) {
      const option = element('option', '', ball.name);
      option.value = ball.id;
      option.title = ball.description;
      control.append(option);
    }
    field.append(labelElement, control);
    form.append(field);
    return control;
  };

  const selectA = select('a', 'Ball A');
  const selectB = select('b', 'Ball B');
  const start = element('button', 'hud-button hud-button-primary picker-start', 'Start match');
  start.type = 'submit';
  form.append(start);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onStart({ a: selectA.value, b: selectB.value });
  });

  return {
    show(matchup) {
      selectA.value = matchup.a;
      selectB.value = matchup.b;
    },
  };
}
