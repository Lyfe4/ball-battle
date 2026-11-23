// The ways to play and where each leads (ADR 0046, 0055, 0081). The Play tab's mode box says what
// Play starts, and its sheet changes it (ADR 0081 addendum, Option B): who (vs Bot, and vs Friend in
// builds with online play) and each opponent's rules, remembered per opponent on this device.
// Against the bot, Play starts that series straight at its lineup; a first visit plays Best of 3 ·
// Reveal · vs Normal bot. Against a friend, Play sends a live challenge on the friend's rules and
// shows the link to share (no rules step).
import { LIVE_FORMATS } from '../api/live.ts';
import { DEFAULT_BOT } from '../sim/bot.ts';
import { DEFAULT_BEST_OF, FORMATS, type BestOf, type Format } from '../sim/series.ts';
import { loadBotLevel, saveBotLevel } from './bot-level.ts';
import { ONLINE_BUILD } from './online-build.ts';
import { loadSeriesLength, parseSeriesLength, saveSeriesLength } from './series-length.ts';
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

/** The vs Bot setup, on these choices: a series link's rules step (`?mode=bo3&fmt=`), as old links. */
export function writeBotSetupParams(params: URLSearchParams, format: Format, bestOf: BestOf): void {
  for (const key of [...params.keys()]) params.delete(key);
  writeSeriesModeParams(params, format, undefined, bestOf);
}

/**
 * Who Play is against. Ranked and Casual join this list later, as more choices in the same sheet
 * (ADR 0081, replacing ADR 0055's 2 × 2 grid).
 */
export type Opponent = 'friend' | 'bot';

/** The opponents a build offers, the bot first: a first visit plays it. */
export function playChoicesFor(online: boolean): readonly Opponent[] {
  return online ? ['bot', 'friend'] : ['bot'];
}

export const PLAY_CHOICES: readonly Opponent[] = playChoicesFor(ONLINE_BUILD);

/** The formats each opponent offers, in one order everywhere: live play is Reveal and Showdown. */
export const SETUP_FORMATS: Readonly<Record<Opponent, readonly Format[]>> = {
  bot: ['reveal', 'showdown', 'blind'],
  friend: LIVE_FORMATS,
};

/** `format` if it is offered, else the first offered: a link or a save from elsewhere. */
export function offeredFormat(offered: readonly Format[], format: Format): Format {
  return offered.includes(format) ? format : (offered[0] ?? 'reveal');
}

/** What Play sends a friend: a live match by a link, its length and format. */
export interface FriendSetup {
  readonly format: Format;
  readonly bestOf: BestOf;
}

/** A first live match: the first live format, Best of 3. */
export const FIRST_FRIEND: FriendSetup = {
  format: SETUP_FORMATS.friend[0] ?? 'reveal',
  bestOf: DEFAULT_BEST_OF,
};

/** What the Play tab's box shows and Play starts: who, and each opponent's rules. */
export interface PlayChoice {
  readonly opponent: Opponent;
  readonly bot: PlaySetup;
  readonly friend: FriendSetup;
}

export const PLAY_OPPONENT_STORAGE_KEY = 'ballbattle.playOpponent';
export const FRIEND_FORMAT_STORAGE_KEY = 'ballbattle.friendFormat';
export const FRIEND_BEST_OF_STORAGE_KEY = 'ballbattle.friendBestOf';

function read(storage: Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // Not remembered this time.
  }
}

/** The friend's rules as remembered here; anything unusable is a first live match's. */
export function loadFriendSetup(storage: Storage): FriendSetup {
  const format = SETUP_FORMATS.friend.find(
    (offered) => offered === read(storage, FRIEND_FORMAT_STORAGE_KEY),
  );
  const bestOf = parseSeriesLength(read(storage, FRIEND_BEST_OF_STORAGE_KEY));
  return { format: format ?? FIRST_FRIEND.format, bestOf };
}

export function saveFriendSetup(storage: Storage, setup: FriendSetup): void {
  write(storage, FRIEND_FORMAT_STORAGE_KEY, setup.format);
  write(storage, FRIEND_BEST_OF_STORAGE_KEY, String(setup.bestOf));
}

/** What Play starts as last chosen here, among `offered`: the bot where its choice isn't offered. */
export function loadPlayChoice(storage: Storage, offered: readonly Opponent[]): PlayChoice {
  const opponent = offered.find((one) => one === read(storage, PLAY_OPPONENT_STORAGE_KEY));
  return {
    opponent: opponent ?? 'bot',
    bot: loadPlaySetup(storage),
    friend: loadFriendSetup(storage),
  };
}

/** Remembers the whole choice: each opponent's rules are its own. */
export function savePlayChoice(storage: Storage, choice: PlayChoice): void {
  write(storage, PLAY_OPPONENT_STORAGE_KEY, choice.opponent);
  savePlaySetup(storage, choice.bot);
  saveFriendSetup(storage, choice.friend);
}
