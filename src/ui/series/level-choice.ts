import { BOT_LEVELS } from '../../sim/bot.ts';
import { element, setText } from '../dom.ts';
import { levelLine } from '../modes-text.ts';
import { createSegmented } from '../segmented.ts';
import { LEVEL_NAMES } from '../series-text.ts';

export interface LevelChoice {
  readonly element: HTMLElement;
  /** Shows `level` as chosen, closed. */
  show(level: string): void;
}

let count = 0;

/**
 * The bot's level where the series is set up (ADR 0046): "vs Normal bot ▾", a disclosure that opens
 * the three levels in place. A choice is reported, closes it and puts focus back on the toggle; the
 * toggle and Escape close it too. It is part of the screen, not a screen of its own, so it adds no
 * history step and the player never leaves the flow.
 */
export function createLevelChoice(onLevel: (level: string) => void): LevelChoice {
  count += 1;
  const id = `lineup-level-${String(count)}`;
  const root = element('div', 'lineup-level');
  const toggle = element('button', 'lineup-level-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', id);
  const text = element('span', 'lineup-level-text');
  const chevron = element('span', 'lineup-level-chevron', '▾');
  chevron.setAttribute('aria-hidden', 'true');
  toggle.append(text, chevron);

  const options = element('div', 'lineup-level-options');
  options.id = id;
  let level = '';
  const levels = createSegmented(
    options,
    `${id}-group`,
    'Bot',
    BOT_LEVELS.map((bot) => ({
      value: bot.id,
      text: LEVEL_NAMES[bot.id] ?? bot.id,
      label: `${LEVEL_NAMES[bot.id] ?? bot.id} bot`,
    })),
    level,
    (chosen) => {
      render(chosen, false);
      onLevel(chosen);
      toggle.focus();
    },
  );

  function render(next: string, open: boolean): void {
    level = next;
    setText(text, levelLine(level));
    levels.select(level);
    toggle.setAttribute('aria-expanded', String(open));
    options.hidden = !open;
    if (open) document.addEventListener('keydown', onKey);
    else document.removeEventListener('keydown', onKey);
  }

  // While open, Escape closes it wherever focus is (ADR 0038: Escape only closes things).
  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    render(level, false);
    toggle.focus();
  }

  toggle.addEventListener('click', () => {
    render(level, options.hidden === true);
  });

  root.append(toggle, options);
  render(level, false);
  return {
    element: root,
    show: (next) => {
      render(next, false);
    },
  };
}
