// Which screen a URL opens. Every screen a player could link to or press Back to is a URL, so
// reading one is a pure function of its parameters, tested against every link shape the game has
// ever written. Quick-match links (`?a=&b=&seed=`) and series links (`?mode=bo3...`, ADR 0017,
// 0019) keep their meaning.
import { parseMatchup, writeMatchParams, type Matchup } from './matchup.ts';
import { parseSeed } from './seed.ts';
import {
  clearSeriesParams,
  parseSeriesParams,
  type SeriesLink,
  type SeriesStep,
} from './series-url.ts';

export type Route =
  /** The front door: a demo match and the way in. A URL with nothing for any other screen. */
  | { readonly screen: 'home' }
  /** Choosing the two balls of a quick match, prefilled with these. */
  | { readonly screen: 'pick'; readonly matchup: Matchup }
  /** A quick match: these two balls, on this seed (a new one when the link has none). */
  | { readonly screen: 'match'; readonly matchup: Matchup; readonly seed: number | undefined }
  /**
   * Best of 3: a series to replay (`play`), or a step of setting one up (choosing the rules, the
   * lineup, its order), prefilled with what the link holds.
   */
  | { readonly screen: 'series'; readonly link: SeriesLink; readonly step: SeriesScreenStep };

/** Where a best-of-3 screen is: the rules first, then the steps a link can name. */
export type SeriesScreenStep = 'rules' | SeriesStep;

export type Screen = Route['screen'];

/** Names a screen that isn't a match or a series: `?view=pick`. */
const VIEW = 'view';

/** The quick-match setup with these two balls: `?view=pick&a=&b=`, nothing else. */
export function writePickParams(params: URLSearchParams, matchup: Matchup): void {
  for (const key of [...params.keys()]) params.delete(key);
  params.set(VIEW, 'pick');
  params.set('a', matchup.a);
  params.set('b', matchup.b);
}

/** Leaves a named screen, before writing a match or a series. */
export function clearView(params: URLSearchParams): void {
  params.delete(VIEW);
}

/** A quick match: `?a=&b=&seed=`, replacing whatever screen the URL was on. */
export function writeMatchUrl(params: URLSearchParams, matchup: Matchup, seed: number): void {
  clearView(params);
  clearSeriesParams(params);
  writeMatchParams(params, matchup, seed);
}

/** The home screen: a URL with no parameters at all. */
export function writeHomeParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
}

/** Reads the screen a URL asks for. Never throws: anything it can't use falls back. */
export function parseRoute(params: URLSearchParams, validIds: readonly string[]): Route {
  if (params.get(VIEW)?.trim().toLowerCase() === 'pick') {
    return { screen: 'pick', matchup: parseMatchup(params, validIds) };
  }
  const link = parseSeriesParams(params, validIds);
  if (link !== undefined) {
    const step =
      link.setup !== undefined ? 'play' : (link.step ?? (link.lineup ? 'lineup' : 'rules'));
    return { screen: 'series', link, step };
  }
  if (!['a', 'b', 'seed'].some((key) => params.has(key))) return { screen: 'home' };
  return {
    screen: 'match',
    matchup: parseMatchup(params, validIds),
    seed: parseSeed(params.get('seed')),
  };
}
