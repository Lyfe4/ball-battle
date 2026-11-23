import { botChooses, SETUP_FORMATS, type Opponent, type PlayChoice } from '../app/modes.ts';
import { BOT_LEVELS } from '../sim/bot.ts';
import { BEST_OF } from '../sim/series.ts';
import { element } from './dom.ts';
import { FORMAT_HINTS, lengthChoiceOf, OPPONENT_CARDS, SHEET_WORDS } from './modes-text.ts';
import { createSegmented, type Segmented } from './segmented.ts';
import { FORMAT_SHORT, LEVEL_NAMES } from './series-text.ts';

export interface PlaySheet {
  readonly element: HTMLDialogElement;
  /** Opens on `choice`, focus on what is chosen first. */
  open(choice: PlayChoice): void;
  /** Closes it, if open (leaving the Play tab). */
  close(): void;
}

export interface PlaySheetActions {
  /** A choice changed: it applies at once (the box, Play, this device's memory). */
  readonly onChange: (choice: PlayChoice) => void;
  /** It closed, by any way out: focus goes back to what opened it. */
  readonly onClosed: () => void;
}

/**
 * "What to play" (ADR 0081 addendum, Option B): a modal dialog the Play tab's box opens, a sheet
 * from the bottom on a phone held upright and a panel in the middle beside and on a desktop. Who
 * (only where a build offers more than the bot), the length, the format (each opponent's own, in
 * one order) and, against the bot where it makes choices, its level: each the shared segmented
 * choice (ADR 0054), applied as it is tapped. Escape, a tap outside, and Done at the top or the
 * full-width one at the bottom close it; the dialog keeps focus inside while it is open.
 */
export function createPlaySheet(
  opponents: readonly Opponent[],
  actions: PlaySheetActions,
): PlaySheet {
  const dialog = element('dialog', 'play-sheet');
  const title = element('h2', 'play-sheet-title', SHEET_WORDS.title);
  title.id = 'play-sheet-title';
  dialog.setAttribute('aria-labelledby', title.id);

  let choice: PlayChoice | undefined;
  const rules = () => (choice?.opponent === 'friend' ? choice.friend : choice?.bot);

  function change(next: PlayChoice): void {
    choice = next;
    render();
    actions.onChange(next);
  }

  const done = (where: string) => {
    const button = element('button', where, SHEET_WORDS.done);
    button.type = 'button';
    button.dataset['sound'] = 'back';
    button.addEventListener('click', () => {
      dialog.close();
    });
    return button;
  };
  // The top Done is a shortcut for a finger at the top: keyboards and screen readers meet one Done,
  // the full-width one at the end (and Escape).
  const shortcut = done('text-link play-sheet-close');
  shortcut.tabIndex = -1;
  shortcut.setAttribute('aria-hidden', 'true');
  const head = element('div', 'play-sheet-head');
  head.append(title, shortcut);

  const group = (name: string) => element('div', `play-sheet-group segmented-rows ${name}`);
  const againstRoot = group('play-sheet-against');
  const against = createSegmented(
    againstRoot,
    'play-sheet-against',
    SHEET_WORDS.against,
    opponents.map((opponent) => ({ value: opponent, text: OPPONENT_CARDS[opponent].name })),
    choice?.opponent ?? 'bot',
    (opponent) => {
      if (choice !== undefined) change({ ...choice, opponent });
    },
  );
  againstRoot.hidden = opponents.length < 2;

  const lengthRoot = group('play-sheet-length');
  const length = createSegmented(
    lengthRoot,
    'play-sheet-length',
    SHEET_WORDS.length,
    BEST_OF.map((bestOf) => ({ value: bestOf, text: lengthChoiceOf(bestOf).name })),
    rules()?.bestOf ?? 3,
    (bestOf) => {
      if (choice === undefined) return;
      if (choice.opponent === 'friend') change({ ...choice, friend: { ...choice.friend, bestOf } });
      else change({ ...choice, bot: { ...choice.bot, bestOf } });
    },
  );

  // Each opponent offers its own formats, so the row is made again when the opponent changes.
  const formatRoot = group('play-sheet-format');
  let formats: { readonly of: Opponent; readonly control: Segmented<string> } | undefined;
  function formatsFor(opponent: Opponent): Segmented<string> {
    if (formats?.of === opponent) return formats.control;
    const control = createSegmented<string>(
      formatRoot,
      'play-sheet-format',
      SHEET_WORDS.format,
      SETUP_FORMATS[opponent].map((format) => ({
        value: format,
        text: FORMAT_SHORT[format],
        hint: FORMAT_HINTS[format],
      })),
      rules()?.format ?? 'reveal',
      (value) => {
        if (choice === undefined) return;
        const format = SETUP_FORMATS[choice.opponent].find((offered) => offered === value);
        if (format === undefined) return;
        if (choice.opponent === 'friend') {
          change({ ...choice, friend: { ...choice.friend, format } });
        } else change({ ...choice, bot: { ...choice.bot, format } });
      },
    );
    formats = { of: opponent, control };
    return control;
  }

  const levelRoot = group('play-sheet-level');
  const level = createSegmented(
    levelRoot,
    'play-sheet-level',
    SHEET_WORDS.level,
    BOT_LEVELS.map((bot) => ({
      value: bot.id,
      text: LEVEL_NAMES[bot.id] ?? bot.id,
      label: `${LEVEL_NAMES[bot.id] ?? bot.id} bot`,
    })),
    choice?.bot.level ?? '',
    (id) => {
      if (choice !== undefined) change({ ...choice, bot: { ...choice.bot, level: id } });
    },
  );

  const groups = element('div', 'play-sheet-groups');
  groups.append(againstRoot, lengthRoot, formatRoot, levelRoot);
  const body = element('div', 'play-sheet-body');
  body.append(head, groups, done('hud-button play-sheet-done'));
  dialog.append(body);

  function render(): void {
    const current = rules();
    if (choice === undefined || current === undefined) return;
    against.select(choice.opponent);
    length.select(current.bestOf);
    formatsFor(choice.opponent).select(current.format);
    level.select(choice.bot.level);
    levelRoot.hidden = choice.opponent !== 'bot' || !botChooses(choice.bot.format);
  }

  // A tap on the backdrop lands on the dialog itself: its body fills the box, so it is outside.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    actions.onClosed();
  });

  return {
    element: dialog,
    open(next) {
      choice = next;
      render();
      if (!dialog.open) dialog.showModal();
      // Into the sheet, onto what is chosen first: a screen reader hears the group and the choice.
      dialog
        .querySelector<HTMLElement>('[role="group"]:not([hidden]) [aria-pressed="true"]')
        ?.focus();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
