import { botChooses, OTHER_MODE_SECTIONS, type OtherMode } from '../app/modes.ts';
import { element, setText } from './dom.ts';
import { levelLine, modeLine, modeName } from './modes-text.ts';
import { createScreenHeader } from './screen-header.ts';

export interface ModesActions {
  readonly onBack: () => void;
  readonly onPick: (mode: OtherMode) => void;
}

export interface Modes {
  setVisible(visible: boolean): void;
  /** Shows the screen with the bot's remembered `level` on the modes it applies to; focuses the heading. */
  open(level: string): void;
}

/**
 * Other modes (ADR 0046): every way to play but home's main one, phone first. One card per mode,
 * in titled sections (Best of 3 vs bot, One match), each with its name, one line on how it plays
 * and, where the bot makes choices, the level it is played against. A tap goes straight to that
 * mode's setup; the level is changed there, where it is used. Sections are data, so a Best of 5 is
 * one more section, not a new screen.
 */
export function createModes(root: HTMLElement, actions: ModesActions): Modes {
  root.replaceChildren();
  root.classList.add('modes');
  const header = createScreenHeader('Other modes', 'Back', actions.onBack);
  const levels: HTMLElement[] = [];

  const sections = OTHER_MODE_SECTIONS.map((section, index) => {
    const titleId = `modes-section-${String(index)}`;
    const wrapper = element('section', 'modes-section');
    wrapper.setAttribute('aria-labelledby', titleId);
    // On a desktop a section takes one column per mode, so sections share a row (modes.css).
    wrapper.style.setProperty('--modes-count', String(section.modes.length));
    const title = element('h2', 'modes-section-title', section.title);
    title.id = titleId;
    const list = element('ul', 'modes-list');
    list.append(
      ...section.modes.map((mode) => {
        const item = element('li', 'modes-item');
        const card = element('button', 'modes-card');
        card.type = 'button';
        card.append(
          element('span', 'modes-card-name', modeName(mode)),
          element('span', 'modes-card-line', modeLine(mode)),
        );
        if (mode.kind === 'series' && botChooses(mode.format)) {
          const level = element('span', 'modes-card-level');
          levels.push(level);
          card.append(level);
        }
        card.addEventListener('click', () => {
          actions.onPick(mode);
        });
        item.append(card);
        return item;
      }),
    );
    wrapper.append(title, list);
    return wrapper;
  });

  root.append(header.element, ...sections);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    open(level) {
      for (const line of levels) setText(line, levelLine(level));
      header.focus();
    },
  };
}
