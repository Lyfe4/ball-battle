import { botChooses, SETUP_FORMATS, type Opponent, type PlayChoice } from '../app/modes.ts';
import { BOT_LEVELS } from '../sim/bot.ts';
import { BEST_OF, type Format } from '../sim/series.ts';
import { element, setText } from './dom.ts';
import { NEW_TAG } from './first-series-text.ts';
import {
  FORMAT_HINTS,
  howChoices,
  lengthChoiceOf,
  OPPONENT_CARDS,
  SHEET_WORDS,
} from './modes-text.ts';
import { createSegmented, type Segmented } from './segmented.ts';
import { createSheet } from './sheet.ts';
import { FORMAT_LINES, FORMAT_SHORT, LEVEL_NAMES } from './series-text.ts';

export interface PlaySheet {
  readonly element: HTMLDialogElement;
  /** Opens on `choice`, focus on its title. */
  open(choice: PlayChoice): void;
  /** Closes it, if open (leaving the Play tab). */
  close(): void;
}

export interface PlaySheetActions {
  /** A choice changed: it applies at once (the box, Play, this device's memory). */
  readonly onChange: (choice: PlayChoice) => void;
  /** It closed, by any way out: focus goes back to what opened it. */
  readonly onClosed: () => void;
  /** Against a friend, Live or By turns: only where the build plays by turns (ADR 0085). */
  readonly turns?: boolean;
  /** A format tagged "New" (ADR 0090): not tried since the first series. */
  readonly isNew?: (format: Format) => boolean;
}

/**
 * "What to play" (ADR 0081 addendum, Option B): a modal dialog the Play tab's box opens, a sheet
 * from the bottom on a phone held upright and a panel in the middle beside and on a desktop. Who
 * (only where a build offers more than the bot), the length, the format (each opponent's own, in
 * one order), against a friend how (Live or By turns, where the build plays by turns) and, against
 * the bot where it makes choices, its level. Rules only, never people (ADR 0089 addendum of
 * 2026-11-27): Play asks who, in "Who do you want to play?". Each the shared segmented
 * choice (ADR 0054), applied as it is tapped, so nothing needs a Done. Built on the sheet (sheet.ts):
 * one close, the shared × last in its head; Escape, a tap outside and Back (home.ts) close it too;
 * focus goes to its title as it opens, and the dialog keeps it inside while it is open.
 */
export function createPlaySheet(
  opponents: readonly Opponent[],
  actions: PlaySheetActions,
): PlaySheet {
  const sheet = createSheet({
    id: 'play-sheet-title',
    title: SHEET_WORDS.title,
    name: 'play-sheet',
    onClosed: actions.onClosed,
  });

  let choice: PlayChoice | undefined;
  const rules = () => (choice?.opponent === 'friend' ? choice.friend : choice?.bot);

  function change(next: PlayChoice): void {
    choice = next;
    // Remembered first (a format chosen is no longer new, ADR 0090), then drawn.
    actions.onChange(next);
    render();
  }

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

  // Each opponent offers its own formats, so the row is made again when the opponent changes; a
  // format's "New" tag (ADR 0090) comes off in place, so focus stays on the format tapped.
  const formatRoot = group('play-sheet-format');
  // The chosen format's rule in a sentence, under the row: a format is never just a name.
  const formatRule = element('p', 'play-sheet-rule');
  let formats: { readonly of: Opponent; readonly control: Segmented<string> } | undefined;
  const tagOf = (format: Format) => (actions.isNew?.(format) === true ? NEW_TAG : undefined);
  function formatsFor(opponent: Opponent): Segmented<string> {
    const offered = SETUP_FORMATS[opponent];
    if (formats?.of === opponent) {
      for (const format of offered) formats.control.retag(format, tagOf(format));
      return formats.control;
    }
    const control = createSegmented<string>(
      formatRoot,
      'play-sheet-format',
      SHEET_WORDS.format,
      offered.map((format) => {
        const tag = tagOf(format);
        return {
          value: format,
          text: FORMAT_SHORT[format],
          hint: FORMAT_HINTS[format],
          ...(tag === undefined ? {} : { tag }),
        };
      }),
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
    // The row is made afresh: the rule goes back under it.
    formatRoot.append(formatRule);
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

  // Against a friend: live now, or by turns (where the build plays by turns).
  const howRoot = group('play-sheet-how');
  const how = createSegmented<string>(
    howRoot,
    'play-sheet-how',
    SHEET_WORDS.how,
    howChoices(),
    choice?.friend.turns === true ? 'turns' : 'live',
    (value) => {
      if (choice !== undefined) {
        change({ ...choice, friend: { ...choice.friend, turns: value === 'turns' } });
      }
    },
  );
  const groups = element('div', 'play-sheet-groups');
  groups.append(againstRoot, howRoot, lengthRoot, formatRoot, levelRoot);
  sheet.content.append(groups);

  function render(): void {
    const current = rules();
    if (choice === undefined || current === undefined) return;
    against.select(choice.opponent);
    length.select(current.bestOf);
    formatsFor(choice.opponent).select(current.format);
    setText(formatRule, FORMAT_LINES[current.format]);
    level.select(choice.bot.level);
    levelRoot.hidden = choice.opponent !== 'bot' || !botChooses(choice.bot.format);
    how.select(choice.friend.turns ? 'turns' : 'live');
    howRoot.hidden = choice.opponent !== 'friend' || actions.turns !== true;
  }

  return {
    element: sheet.element,
    open(next) {
      choice = next;
      render();
      sheet.open();
    },
    close: () => {
      sheet.close();
    },
  };
}
