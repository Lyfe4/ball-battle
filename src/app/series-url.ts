// A best-of-3 series in the URL (ADR 0017, 0019): `?mode=bo3&la=a,b,c&lb=d,e,f&seed=N` holds both
// lineups and the series seed; `fmt=reveal` or `fmt=loser` names a draft format (none is blind), and
// a series with picks adds `picks=x,y,...`, every pick in order (ADR 0019, 0021). That is everything that decides a
// series, so the link replays it exactly. A link with only `mode=bo3` (and perhaps `fmt`), or with
// anything invalid, opens the lineup builder instead.
import {
  FORMATS,
  isValidLineup,
  LINEUP_SIZE,
  type Format,
  type Lineup,
  type SeriesSetup,
} from '../sim/series.ts';
import { parseSeed } from './seed.ts';

export const SERIES_MODE = 'bo3';
const KEYS = {
  mode: 'mode',
  a: 'la',
  b: 'lb',
  seed: 'seed',
  format: 'fmt',
  picks: 'picks',
  step: 'step',
} as const;

/**
 * The best-of-3 setup step a URL is on, past the first (choosing the rules). Only a link that holds
 * a whole series replays one; the others are steps of setting one up, and `play` and `order` fall
 * back to the lineup after a reload, since the bot's lineup is never in the URL until the end.
 */
export type SeriesStep = 'lineup' | 'answer' | 'play';
const STEPS: readonly SeriesStep[] = ['lineup', 'answer', 'play'];

/** What a URL asks for in best-of-3 mode. */
export interface SeriesLink {
  /** A complete, valid series to replay. */
  readonly setup?: SeriesSetup;
  /** The player's lineup alone, when it is valid but the rest is not: prefills the builder. */
  readonly lineup?: Lineup;
  /** The draft format, when the link names a valid one: preselects it in the builder. */
  readonly format?: Format;
  /** The setup step, when the link names one. */
  readonly step?: SeriesStep;
}

const ids = (raw: string): string[] => raw.split(',').map((id) => id.trim().toLowerCase());

function readLineup(raw: string | null, validIds: readonly string[]): Lineup | undefined {
  if (raw === null) return undefined;
  const list = ids(raw);
  return isValidLineup(list, validIds) ? list : undefined;
}

/** The format named in the link: blind when absent, undefined when unknown (invalid). */
function readFormat(raw: string | null): Format | undefined {
  if (raw === null || raw.trim() === '') return 'blind';
  const name = raw.trim().toLowerCase();
  return FORMATS.find((format) => format === name);
}

/** Picks a whole series of each format records (ADR 0019, 0021); a blind series has none. */
const PICKS: Readonly<Record<Format, { readonly min: number; readonly max: number }>> = {
  blind: { min: 0, max: 0 },
  // Loser picks next: at most one per round after the first.
  loser: { min: 0, max: LINEUP_SIZE - 1 },
  // Reveal: both sides pick in rounds 1 and 2, and a series is never decided before round 2.
  reveal: { min: 4, max: 4 },
};

/**
 * The picks in a link, each a ball from one of the two lineups. Whether each pick was legal is
 * checked when the series replays.
 */
function readPicks(raw: string | null, a: Lineup, b: Lineup): string[] | undefined {
  if (raw === null || raw.trim() === '') return [];
  const list = ids(raw);
  if (list.length > LINEUP_SIZE + 1) return undefined;
  return list.every((id) => a.includes(id) || b.includes(id)) ? list : undefined;
}

/**
 * Reads a series from URL parameters. Undefined when the URL is not in best-of-3 mode (a quick
 * match link). A typo or tampered value never throws: it just drops what it can't use.
 */
export function parseSeriesParams(
  params: URLSearchParams,
  validIds: readonly string[],
): SeriesLink | undefined {
  if (params.get(KEYS.mode)?.trim().toLowerCase() !== SERIES_MODE) return undefined;
  const a = readLineup(params.get(KEYS.a), validIds);
  const b = readLineup(params.get(KEYS.b), validIds);
  const seed = parseSeed(params.get(KEYS.seed));
  const format = readFormat(params.get(KEYS.format));
  const stepName = params.get(KEYS.step)?.trim().toLowerCase();
  const step = STEPS.find((name) => name === stepName);
  const named = {
    ...(format === undefined || format === 'blind' ? {} : { format }),
    ...(step === undefined ? {} : { step }),
  };
  if (a !== undefined && b !== undefined && seed !== undefined && format !== undefined) {
    const picks = readPicks(params.get(KEYS.picks), a, b);
    // A reveal link from before ADR 0021 has no picks: it can't replay under the new rules, so it
    // falls back to the lineup, prefilled, like any other link that doesn't hold a whole series.
    const { min, max } = PICKS[format];
    const valid = picks !== undefined && picks.length >= min && picks.length <= max;
    if (valid) {
      const extra = format === 'blind' ? {} : { format };
      const withPicks = picks.length > 0 ? { picks } : {};
      return { setup: { seed, a, b, ...extra, ...withPicks } };
    }
  }
  return a === undefined ? named : { lineup: a, ...named };
}

/** Writes a whole series into URL parameters, replacing any quick-match ones. */
export function writeSeriesParams(params: URLSearchParams, setup: SeriesSetup): void {
  writeSeriesModeParams(params, setup.format);
  params.delete(KEYS.step);
  params.set(KEYS.a, setup.a.join(','));
  params.set(KEYS.b, setup.b.join(','));
  params.set(KEYS.seed, String(setup.seed));
  if (setup.picks !== undefined && setup.picks.length > 0) {
    params.set(KEYS.picks, setup.picks.join(','));
  }
}

/**
 * Best-of-3 mode with nothing decided yet (building a lineup, or a series in progress), and the
 * chosen format. The bot's lineup is not written until the series ends, so the address bar never
 * gives it away.
 */
export function writeSeriesModeParams(
  params: URLSearchParams,
  format?: Format,
  step?: SeriesStep,
): void {
  clearMatchParams(params);
  params.delete(KEYS.step);
  params.set(KEYS.mode, SERIES_MODE);
  if (format !== undefined && format !== 'blind') params.set(KEYS.format, format);
  if (step !== undefined) params.set(KEYS.step, step);
}

/** Removes every series parameter, for switching back to a quick match. */
export function clearSeriesParams(params: URLSearchParams): void {
  params.delete(KEYS.mode);
  params.delete(KEYS.a);
  params.delete(KEYS.b);
  params.delete(KEYS.format);
  params.delete(KEYS.picks);
  params.delete(KEYS.step);
}

function clearMatchParams(params: URLSearchParams): void {
  params.delete('a');
  params.delete('b');
  params.delete(KEYS.a);
  params.delete(KEYS.b);
  params.delete(KEYS.seed);
  params.delete(KEYS.format);
  params.delete(KEYS.picks);
}
