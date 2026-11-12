import { botChooses, OTHER_MODE_SECTIONS, type OtherMode } from '../app/modes.ts';
import { BEST_OF, DEFAULT_BEST_OF, type BestOf } from '../sim/series.ts';
import { element, setText } from './dom.ts';
import { lengthChoiceOf, levelLine, modeLine, modeName } from './modes-text.ts';
import { createScreenHeader } from './screen-header.ts';
import { createSegmented } from './segmented.ts';

export interface ModesActions {
  readonly onBack: () => void;
  /** A card was tapped: its mode, at the length chosen above it (Best of 3 for Free play). */
  readonly onPick: (mode: OtherMode, bestOf: BestOf) => void;
  /** The player chose a series length (ADR 0048), to remember. */
  readonly onLength: (bestOf: BestOf) => void;
}

export interface Modes {
  setVisible(visible: boolean): void;
  /**
   * Shows the screen with the remembered series `bestOf` chosen and the bot's remembered `level` on
   * the modes it applies to; focuses the heading.
   */
  open(level: string, bestOf: BestOf): void;
}

/**
 * Other modes (ADR 0046, 0048): every way to play but home's main one, phone first. One card per
 * mode, in titled sections (Series vs bot, One match), each with its name, one line on how it plays
 * and, where the bot makes choices, the level it is played against. The series section opens with
 * a Best of 3 / Best of 5 choice and the rule it plays by; a tap on a card goes straight to that
 * mode's setup at that length. The level is changed there, where it is used.
 */
export function createModes(root: HTMLElement, actions: ModesActions): Modes {
  root.replaceChildren();
  root.classList.add('modes');
  const header = createScreenHeader('Other modes', 'Back', actions.onBack);
  const levels: HTMLElement[] = [];
  let bestOf: BestOf = DEFAULT_BEST_OF;
  const lengthControls: ((next: BestOf) => void)[] = [];

  /** The length choice and its rule line ("5 balls each · first to 3 wins"). */
  function lengthChoice(index: number): HTMLElement {
    const holder = element('div', 'modes-length');
    const group = element('div', 'modes-length-choice');
    const rule = element('p', 'modes-length-rule');
    const segmented = createSegmented(
      group,
      `modes-length-${String(index)}`,
      'Length',
      BEST_OF.map((length) => ({ value: length, text: lengthChoiceOf(length).name })),
      bestOf,
      (chosen) => {
        show(chosen);
        actions.onLength(chosen);
      },
    );
    function show(next: BestOf): void {
      bestOf = next;
      segmented.select(next);
      setText(rule, lengthChoiceOf(next).rule);
    }
    lengthControls.push(show);
    holder.append(group, rule);
    return holder;
  }

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
          actions.onPick(mode, section.lengthChoice === true ? bestOf : DEFAULT_BEST_OF);
        });
        item.append(card);
        return item;
      }),
    );
    wrapper.append(title);
    if (section.lengthChoice === true) wrapper.append(lengthChoice(index));
    wrapper.append(list);
    return wrapper;
  });

  root.append(header.element, ...sections);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    open(level, length) {
      for (const line of levels) setText(line, levelLine(level));
      for (const show of lengthControls) show(length);
      header.focus();
    },
  };
}
