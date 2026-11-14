// Best of 3 survives a reload (ADR 0042): the series being played or held, and the setup in
// progress (the lineup tray, and in Reveal and Showdown the series revealed for round 1's pick),
// are kept in the browser's storage on this device. Never in the URL: the bot's lineup and its
// choices stay out of the address bar until the series is decided (ADR 0017).
//
// Saved data is plain JSON and is read as untrusted: anything that doesn't parse into the expected
// shape is dropped, and a series is only put back if `restoreSeries` accepts it. Storage can be
// missing or throw (private windows, blocked site data); then the series simply isn't kept across
// a reload, as before.
import { BEST_OF, type SeriesSetup } from '../sim/series.ts';
import { decodeSeriesSetup, isUint32 } from '../sim/series-decode.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import type { Draft } from '../ui/lineup-draft.ts';
import { restoreSeries, savedOf, type SavedSeries } from './series-restore.ts';
import { beginSession, botOf, resolvePicks, type SeriesSession } from './series-session.ts';

/** The series being played or held. */
export const SERIES_STORAGE_KEY = 'ballbattle.series';
/** The setup in progress: the lineup tray, and the series revealed for round 1's pick. */
export const SERIES_SETUP_STORAGE_KEY = 'ballbattle.seriesSetup';
/** The shape of what is saved; a save in another shape is dropped. */
const SAVE_VERSION = 1;

export type SaveStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The setup in progress, as saved. */
export interface SavedSetup {
  readonly draft: Draft;
  /** Reveal and Showdown: the series about to start, while round 1's pick is being made. */
  readonly revealed?: SeriesSetup;
}

/** What is saved under `key`: undefined when nothing is (or storage can't be read), null when it isn't JSON. */
function read(storage: SaveStorage, key: string): unknown {
  let raw: string | null;
  try {
    raw = storage().getItem(key);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function write(storage: SaveStorage, key: string, value: object | undefined): void {
  try {
    if (value === undefined) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify({ save: SAVE_VERSION, ...value }));
  } catch {
    // Not kept this time: the series still plays, it just won't survive a reload.
  }
}

/** Keeps the session, so a reload puts it back where it is now. */
export function saveSeries(storage: SaveStorage, session: SeriesSession): void {
  write(storage, SERIES_STORAGE_KEY, savedOf(session));
}

/** Forgets the saved series (left on purpose, or replaced). */
export function clearSeries(storage: SaveStorage): void {
  write(storage, SERIES_STORAGE_KEY, undefined);
}

/**
 * The saved series, put back where it was; undefined when there is none. A save that can't be
 * read or restored (another ruleset, broken, tampered with) is removed, so it is only met once.
 */
export function loadSeries(
  storage: SaveStorage,
  definitions: DefinitionLookup,
): SeriesSession | undefined {
  const raw = read(storage, SERIES_STORAGE_KEY);
  if (raw === undefined) return undefined;
  const saved = asSavedSeries(raw, [...definitions.keys()]);
  const session = saved === undefined ? undefined : restoreSeries(saved, definitions);
  if (session === undefined) clearSeries(storage);
  return session;
}

export function saveSetup(storage: SaveStorage, setup: SavedSetup): void {
  write(storage, SERIES_SETUP_STORAGE_KEY, {
    // JSON has no undefined: an empty slot is saved as null.
    draft: setup.draft.map((slot) => slot ?? null),
    ...(setup.revealed === undefined ? {} : { revealed: setup.revealed }),
  });
}

/**
 * The saved setup in progress. A tray that doesn't read is empty; a revealed series is kept only
 * if it is one that can start under today's rules, with no pick made yet.
 */
export function loadSetup(storage: SaveStorage, definitions: DefinitionLookup): SavedSetup {
  const raw = read(storage, SERIES_SETUP_STORAGE_KEY);
  if (!isRecord(raw) || raw['save'] !== SAVE_VERSION) return { draft: [] };
  const roster = [...definitions.keys()];
  const draft = asDraft(raw['draft'], roster);
  const setup = asSetup(raw['revealed'], roster);
  const startable =
    setup !== undefined &&
    setup.picks === undefined &&
    setup.format !== undefined &&
    // As the series would start: in Reveal the bot may show its ball before the player picks.
    restoreSeries(savedOf(resolvePicks(beginSession(setup), botOf(setup))), definitions) !==
      undefined;
  return startable ? { draft, revealed: setup } : { draft };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function asIds(value: unknown, roster: readonly string[]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is string => typeof id === 'string' && roster.includes(id));
  return ids.length === value.length ? ids : undefined;
}

function asDraft(value: unknown, roster: readonly string[]): Draft {
  // The longest tray is a Best of 5's (ADR 0048).
  if (!Array.isArray(value) || value.length > Math.max(...BEST_OF)) return [];
  const slots = value.map((slot) => (typeof slot === 'string' ? slot : undefined));
  const balls = slots.filter((slot) => slot !== undefined);
  const valid =
    value.every((slot) => slot === null || (typeof slot === 'string' && roster.includes(slot))) &&
    new Set(balls).size === balls.length &&
    slots.at(-1) !== undefined;
  return valid ? slots : [];
}

/** A series setup against a bot, read by the sim's decoder; undefined if it isn't one. */
function asSetup(value: unknown, roster: readonly string[]): SeriesSetup | undefined {
  const decoded = decodeSeriesSetup(value, roster);
  if (!decoded.ok) return undefined;
  const { setup } = decoded;
  // Every saved series is against the bot (a player opponent is for a server, ADR 0022), and the
  // game saves Blind as no format at all, so a revealed setup always names its format.
  return setup.opponent.kind === 'bot' && setup.format !== 'blind' ? setup : undefined;
}

function asSavedSeries(value: unknown, roster: readonly string[]): SavedSeries | undefined {
  if (!isRecord(value) || value['save'] !== SAVE_VERSION) return undefined;
  const setup = asSetup(value['setup'], roster);
  const { plays, recorded, link } = value;
  if (setup === undefined || !isUint32(plays) || typeof recorded !== 'boolean') return undefined;
  const linkPicks = link === undefined ? undefined : asIds(link, roster);
  if (link !== undefined && linkPicks === undefined) return undefined;
  return { setup, plays, recorded, ...(linkPicks === undefined ? {} : { link: linkPicks }) };
}
