import { BOT_LEVELS } from '../../sim/bot.ts';
import { BEST_OF, DEFAULT_BEST_OF, type BestOf, type Format } from '../../sim/series.ts';
import { busyOnClick } from '../busy-button.ts';
import { element, setText } from '../dom.ts';
import { lengthChoiceOf } from '../modes-text.ts';
import { createScreenHeader } from '../screen-header.ts';
import { createSegmented } from '../segmented.ts';
import { FORMAT_LINES, FORMAT_SHORT, LEVEL_NAMES } from '../series-text.ts';

/** What the setup shows as chosen: the length, the format and (against the bot) its level. */
export interface SetupChoices {
  readonly bestOf: BestOf;
  readonly format: Format;
  readonly level: string;
}

export interface RulesStep {
  readonly element: HTMLElement;
  /** Shows `choices` as chosen and moves focus to the heading. */
  open(choices: SetupChoices): void;
}

export interface RulesOptions {
  /** The heading: who the series is against ("vs Bot", "vs Friend"). */
  readonly title: string;
  /** The formats offered, as cards, in order. */
  readonly formats: readonly Format[];
  /** Against the bot: its level, shown where the bot makes choices (never for Blind). */
  readonly levels: boolean;
  /** One quiet line under the choices: what the match asks of the player (live play). */
  readonly note?: string;
  /** What the main button says (else Choose lineup): vs Friend sends the challenge from here. */
  readonly next?: string;
}

export interface RulesActions {
  readonly onBack: () => void;
  /** Any choice changed (the screen keeps it, so Back to it finds it as it was). */
  readonly onChange: (choices: SetupChoices) => void;
  /** The player goes on with these choices; a promise is a request (the button shows it). */
  readonly onNext: (choices: SetupChoices) => unknown;
}

let count = 0;

/**
 * An opponent's setup screen (ADR 0055): the length (Best of 3 or 5, with the rule it plays by),
 * the format as cards with one line on how each plays (ADR 0019: chosen reading, not guessing from
 * a short label), against the bot its level, then Choose lineup. Every choice is a `.choice` in the
 * shared chosen look (ADR 0054). The same screen for every opponent: vs Bot and vs Friend differ
 * only in their formats, the level and a note.
 */
export function createRulesStep(options: RulesOptions, actions: RulesActions): RulesStep {
  count += 1;
  const id = `setup-${String(count)}`;
  const root = element('section', 'series-step rules-step');
  const header = createScreenHeader(options.title, 'Back', actions.onBack);
  let choices: SetupChoices = {
    bestOf: DEFAULT_BEST_OF,
    format: options.formats[0] ?? 'reveal',
    level: '',
  };

  function choose(next: Partial<SetupChoices>): void {
    choices = { ...choices, ...next };
    render();
    actions.onChange(choices);
  }

  const lengthRoot = element('div', 'rules-length');
  const length = createSegmented(
    lengthRoot,
    `${id}-length`,
    'Length',
    BEST_OF.map((bestOf) => ({ value: bestOf, text: lengthChoiceOf(bestOf).name })),
    choices.bestOf,
    (bestOf) => {
      choose({ bestOf });
    },
  );
  const rule = element('p', 'series-step-hint rules-rule');
  const lengthGroup = element('div', 'rules-group rules-length-group');
  lengthGroup.append(lengthRoot, rule);

  const formatTitleId = `${id}-format`;
  const formatTitle = element('span', 'segmented-label', 'Format');
  formatTitle.id = formatTitleId;
  const group = element('div', 'rules-cards');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', formatTitleId);
  const cards = options.formats.map((format) => {
    const card = element('button', 'rules-card choice');
    card.type = 'button';
    card.append(
      element('span', 'rules-card-name', FORMAT_SHORT[format]),
      element('span', 'rules-card-line', FORMAT_LINES[format]),
    );
    card.addEventListener('click', () => {
      choose({ format });
    });
    return { format, card };
  });
  group.append(...cards.map(({ card }) => card));
  const formatGroup = element('div', 'rules-group rules-format-group');
  formatGroup.append(formatTitle, group);

  const levelRoot = element('div', 'rules-level');
  const levels = createSegmented(
    levelRoot,
    `${id}-level`,
    'Bot',
    BOT_LEVELS.map((bot) => ({
      value: bot.id,
      text: LEVEL_NAMES[bot.id] ?? bot.id,
      label: `${LEVEL_NAMES[bot.id] ?? bot.id} bot`,
    })),
    choices.level,
    (level) => {
      choose({ level });
    },
  );
  levelRoot.hidden = !options.levels;

  const body = element('div', 'rules-body');
  body.append(lengthGroup, formatGroup, levelRoot);
  if (options.note !== undefined) body.append(element('p', 'rules-note', options.note));

  const next = element('button', 'hud-button hud-button-primary', options.next ?? 'Choose lineup');
  next.type = 'button';
  if (options.next !== undefined) next.dataset['sound'] = 'tap';
  busyOnClick(next, () => actions.onNext(choices));
  const footer = element('div', 'screen-footer');
  footer.append(next);
  root.append(header.element, body, footer);

  function render(): void {
    length.select(choices.bestOf);
    setText(rule, lengthChoiceOf(choices.bestOf).rule);
    for (const { format, card } of cards) {
      card.setAttribute('aria-pressed', String(format === choices.format));
    }
    levelRoot.hidden = !options.levels || choices.format === 'blind';
    levels.select(choices.level);
  }

  return {
    element: root,
    open(current) {
      const offered = options.formats.includes(current.format);
      choices = { ...current, format: offered ? current.format : (options.formats[0] ?? 'reveal') };
      render();
      header.focus();
    },
  };
}
