// A best-of-3 series in the URL (ADR 0017): `?mode=bo3&la=a,b,c&lb=d,e,f&seed=N` holds both
// lineups and the series seed, which is everything that decides it, so the link replays the series
// exactly. A link with only `mode=bo3`, or with anything invalid, opens the lineup builder instead.
import { isValidLineup, type Lineup, type SeriesSetup } from '../sim/series.ts';
import { parseSeed } from './seed.ts';

export const SERIES_MODE = 'bo3';
const KEYS = { mode: 'mode', a: 'la', b: 'lb', seed: 'seed' } as const;

/** What a URL asks for in best-of-3 mode. */
export interface SeriesLink {
  /** A complete, valid series to replay. */
  readonly setup?: SeriesSetup;
  /** The player's lineup alone, when it is valid but the rest is not: prefills the builder. */
  readonly lineup?: Lineup;
}

function readLineup(raw: string | null, validIds: readonly string[]): Lineup | undefined {
  if (raw === null) return undefined;
  const ids = raw.split(',').map((id) => id.trim().toLowerCase());
  return isValidLineup(ids, validIds) ? ids : undefined;
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
  if (a !== undefined && b !== undefined && seed !== undefined) return { setup: { seed, a, b } };
  return a === undefined ? {} : { lineup: a };
}

/** Writes a whole series into URL parameters, replacing any quick-match ones. */
export function writeSeriesParams(params: URLSearchParams, setup: SeriesSetup): void {
  clearMatchParams(params);
  params.set(KEYS.mode, SERIES_MODE);
  params.set(KEYS.a, setup.a.join(','));
  params.set(KEYS.b, setup.b.join(','));
  params.set(KEYS.seed, String(setup.seed));
}

/**
 * Best-of-3 mode with nothing decided yet (building a lineup, or a series in progress). The bot's
 * lineup is not written until the series ends, so the address bar never gives it away.
 */
export function writeSeriesModeParams(params: URLSearchParams): void {
  clearMatchParams(params);
  params.set(KEYS.mode, SERIES_MODE);
}

/** Removes every series parameter, for switching back to a quick match. */
export function clearSeriesParams(params: URLSearchParams): void {
  params.delete(KEYS.mode);
  params.delete(KEYS.a);
  params.delete(KEYS.b);
}

function clearMatchParams(params: URLSearchParams): void {
  params.delete('a');
  params.delete('b');
  params.delete(KEYS.a);
  params.delete(KEYS.b);
  params.delete(KEYS.seed);
}
