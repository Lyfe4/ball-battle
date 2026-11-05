// Which screen a URL opens. Every screen a player could link to or press Back to is a URL, so
// reading one is a pure function of its parameters, tested against every link shape the game has
// ever written. Quick-match links (`?a=&b=&seed=`) and series links (`?mode=bo3...`, ADR 0017,
// 0019) keep their meaning.
import { parseMatchup, type Matchup } from './matchup.ts';
import { parseSeed } from './seed.ts';
import { parseSeriesParams, type SeriesLink } from './series-url.ts';

export type Route =
  /** A quick match: these two balls, on this seed (a new one when the link has none). */
  | { readonly screen: 'match'; readonly matchup: Matchup; readonly seed: number | undefined }
  /** Best of 3: a series to replay, or the setup, prefilled with what the link holds. */
  | { readonly screen: 'series'; readonly link: SeriesLink };

export type Screen = Route['screen'];

/** Reads the screen a URL asks for. Never throws: anything it can't use falls back. */
export function parseRoute(params: URLSearchParams, validIds: readonly string[]): Route {
  const link = parseSeriesParams(params, validIds);
  if (link !== undefined) return { screen: 'series', link };
  return {
    screen: 'match',
    matchup: parseMatchup(params, validIds),
    seed: parseSeed(params.get('seed')),
  };
}
