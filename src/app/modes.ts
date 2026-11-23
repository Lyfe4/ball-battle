// The ways to play and where each leads (ADR 0046, 0055, 0081). The Play tab's chooser picks who to
// play: vs Bot, and vs Friend in builds with online play. Against the bot, Play starts the player's
// last series as they set it up (its length, format and level), straight to its lineup; a first
// visit plays Best of 3 · Reveal · vs Normal bot. Against a friend, Play opens the send screen.
// Change rules opens the chosen opponent's setup. Play only ever remembers bot games: a friend
// match needs a link, so it never becomes Play's setup.
import { LIVE_FORMATS } from '../api/live.ts';
import { DEFAULT_BOT } from '../sim/bot.ts';
import { DEFAULT_BEST_OF, FORMATS, type BestOf, type Format } from '../sim/series.ts';
import { loadBotLevel, saveBotLevel } from './bot-level.ts';
import { ONLINE_BUILD } from './online-build.ts';
import { writeSendParams } from './online-url.ts';
import { loadSeriesLength, saveSeriesLength } from './series-length.ts';
import { writeSeriesModeParams } from './series-url.ts';

/** Whether the bot makes choices a level changes (ADR 0035): never in Blind. */
export function botChooses(format: Format): boolean {
  return format !== 'blind';
}

/** What home's Play starts: a series against the bot, as last set up on this device. */
export interface PlaySetup {
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The bot's level (ADR 0035), shared with the lineup step's own level choice. */
  readonly level: string;
}

/**
 * A first visit's Play: Best of 3, Reveal, against the Normal bot. Reveal is measured with the most
 * skill, the most reads and the most different bot levels (`docs/best-of-5-measurements.md`).
 */
export const FIRST_PLAY: PlaySetup = {
  format: 'reveal',
  bestOf: DEFAULT_BEST_OF,
  level: DEFAULT_BOT.id,
};

/** The browser storage key Play's format is remembered under (its length and level have theirs). */
export const PLAY_FORMAT_STORAGE_KEY = 'ballbattle.playFormat';

type Storage = () => Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** The format `raw` names, else the first visit's. */
export function parsePlayFormat(raw: string | null | undefined): Format {
  return FORMATS.find((format) => format === raw?.trim().toLowerCase()) ?? FIRST_PLAY.format;
}

/** Play's setup as remembered on this device; storage that is missing or throws is a first visit. */
export function loadPlaySetup(storage: Storage): PlaySetup {
  let format = FIRST_PLAY.format;
  try {
    format = parsePlayFormat(storage().getItem(PLAY_FORMAT_STORAGE_KEY));
  } catch {
    // A first visit's format.
  }
  return { format, bestOf: loadSeriesLength(storage), level: loadBotLevel(storage) };
}

/** Remembers a series set up against the bot as Play's, if storage allows. */
export function savePlaySetup(storage: Storage, setup: PlaySetup): void {
  try {
    storage().setItem(PLAY_FORMAT_STORAGE_KEY, setup.format);
  } catch {
    // Not remembered this time; Play keeps its last setup.
  }
  saveSeriesLength(storage, setup.bestOf);
  saveBotLevel(storage, setup.level);
}

/** Play's one tap: the remembered series' lineup step. */
export function writePlayParams(params: URLSearchParams, setup: PlaySetup): void {
  for (const key of [...params.keys()]) params.delete(key);
  writeSeriesModeParams(params, setup.format, 'lineup', setup.bestOf);
}

/** The vs Bot setup, on these choices: a series link's rules step (`?mode=bo3&fmt=`). */
export function writeBotSetupParams(params: URLSearchParams, format: Format, bestOf: BestOf): void {
  for (const key of [...params.keys()]) params.delete(key);
  writeSeriesModeParams(params, format, undefined, bestOf);
}

/**
 * Who the Play tab's chooser plays against. Ranked and Casual join this list later, as more
 * choices in the same chooser (ADR 0081, amending ADR 0055's 2 × 2 grid).
 */
export type Opponent = 'friend' | 'bot';

/** The chooser's choices in a build with or without online play, the bot first: it starts there. */
export function playChoicesFor(online: boolean): readonly Opponent[] {
  return online ? ['bot', 'friend'] : ['bot'];
}

export const PLAY_CHOICES: readonly Opponent[] = playChoicesFor(ONLINE_BUILD);

/** The friend setup a first live match opens on: the first live format, Best of 3. */
function writeFriendSetup(params: URLSearchParams): void {
  writeSendParams(params, LIVE_FORMATS[0] ?? 'reveal', DEFAULT_BEST_OF);
}

/** Play against `opponent`: the bot's remembered series at its lineup, or the send screen. */
export function writeOpponentPlayParams(
  params: URLSearchParams,
  opponent: Opponent,
  setup: PlaySetup,
): void {
  if (opponent === 'bot') writePlayParams(params, setup);
  else writeFriendSetup(params);
}

/** Change rules for `opponent`: the vs Bot setup on Play's choices, or the friend setup. */
export function writeChangeRulesParams(
  params: URLSearchParams,
  opponent: Opponent,
  setup: PlaySetup,
): void {
  if (opponent === 'bot') writeBotSetupParams(params, setup.format, setup.bestOf);
  else writeFriendSetup(params);
}

/** The formats each opponent's setup offers: live play is Reveal and Showdown only (ADR 0053). */
export const SETUP_FORMATS: Readonly<Record<Opponent, readonly Format[]>> = {
  bot: ['reveal', 'showdown', 'blind'],
  friend: LIVE_FORMATS,
};
