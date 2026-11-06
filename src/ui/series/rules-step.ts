import { BOT_LEVELS } from '../../sim/bot.ts';
import { FORMATS, type Format } from '../../sim/series.ts';
import { element } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { createSegmented } from '../segmented.ts';
import { FORMAT_LINES, FORMAT_NAMES, LEVEL_NAMES, SERIES_RULE } from '../series-text.ts';

export interface RulesStep {
  readonly element: HTMLElement;
  /** Shows `format` and the bot's `level` as chosen and moves focus to the heading. */
  open(format: Format, level: string): void;
}

export interface RulesActions {
  readonly onBack: () => void;
  /** The player chose the bot's level (ADR 0035). */
  readonly onLevel: (level: string) => void;
  /** The player chose a format and goes on to their lineup. */
  readonly onNext: (format: Format) => void;
}

/**
 * The first step of a best-of-3 series: choosing how orders are set (ADR 0019), and how hard the
 * bot plays (ADR 0035). Each format is a card with one line on how it plays, so the choice is made
 * reading, not guessing from a short label. The level is one small segmented choice under them,
 * hidden for Blind, where the bot makes no choices a level could change.
 */
export function createRulesStep(actions: RulesActions): RulesStep {
  const root = element('section', 'series-step rules-step');
  const header = createScreenHeader('Best of 3', 'Back', actions.onBack);
  const intro = element('p', 'series-step-hint', SERIES_RULE);
  const group = element('div', 'rules-cards');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'How orders are set');
  let chosen: Format = 'blind';

  const cards = FORMATS.map((format) => {
    const card = element('button', 'rules-card');
    card.type = 'button';
    card.append(
      element('span', 'rules-card-name', FORMAT_NAMES[format]),
      element('span', 'rules-card-line', FORMAT_LINES[format]),
    );
    card.addEventListener('click', () => {
      chosen = format;
      render();
    });
    return { format, card };
  });
  group.append(...cards.map(({ card }) => card));

  const levelRoot = element('div', 'rules-level');
  let level = '';
  const levels = createSegmented(
    levelRoot,
    'bot-level',
    'Bot',
    BOT_LEVELS.map((bot) => ({
      value: bot.id,
      text: LEVEL_NAMES[bot.id] ?? bot.id,
      label: `${LEVEL_NAMES[bot.id] ?? bot.id} bot`,
    })),
    level,
    (chosen) => {
      level = chosen;
      actions.onLevel(chosen);
    },
  );

  const next = element('button', 'hud-button hud-button-primary', 'Choose lineup');
  next.type = 'button';
  next.addEventListener('click', () => {
    actions.onNext(chosen);
  });
  const footer = element('div', 'screen-footer');
  footer.append(next);
  root.append(header.element, intro, group, levelRoot, footer);

  function render(): void {
    for (const { format, card } of cards) {
      card.setAttribute('aria-pressed', String(format === chosen));
    }
    levelRoot.hidden = chosen === 'blind';
    levels.select(level);
  }

  return {
    element: root,
    open(format, current) {
      chosen = format;
      level = current;
      render();
      header.focus();
    },
  };
}
