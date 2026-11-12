// Which screen a URL opens. Every screen a player could link to or press Back to is a URL, so
// reading one is a pure function of its parameters, tested against every link shape the game has
// ever written. Quick-match links (`?a=&b=&seed=`) and series links (`?mode=bo3...`, ADR 0017,
// 0019) keep their meaning.
import { parseMatchup, writeMatchParams, type Matchup } from './matchup.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { verifySeries } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { parseSeed, parseVersion } from './seed.ts';
import {
  clearSeriesParams,
  parseSeriesParams,
  type SeriesLink,
  type SeriesStep,
} from './series-url.ts';

export type Route =
  /** The front door: a demo match and the way in. A URL with nothing for any other screen. */
  | { readonly screen: 'home' }
  /** Every way to play but home's main one (ADR 0046): `?view=modes`. */
  | { readonly screen: 'modes' }
  /**
   * The ball manual: the roster, or one ball's entry (`ball`), or the matchup chart (`chart`).
   */
  | {
      readonly screen: 'manual';
      readonly ball: string | undefined;
      readonly chart: boolean;
    }
  /** Choosing the two balls of a quick match, prefilled with these. */
  | { readonly screen: 'pick'; readonly matchup: Matchup }
  /** A quick match: these two balls, on this seed (a new one when the link has none). */
  | { readonly screen: 'match'; readonly matchup: Matchup; readonly seed: number | undefined }
  /**
   * Best of 3: a series to replay (`play`), or a step of setting one up (choosing the rules, the
   * lineup, its order), prefilled with what the link holds.
   */
  | { readonly screen: 'series'; readonly link: SeriesLink; readonly step: SeriesScreenStep }
  /**
   * A replay link (a quick match with its seed, or a decided series) made under another ruleset
   * than this page's (ADR 0022). It would not replay the fight it recorded, so it isn't played
   * until the player chooses to play it under this page's rules. `made` is the link's ruleset (0
   * for a link from before versions).
   */
  | { readonly screen: 'outdated'; readonly kind: 'match' | 'series'; readonly made: number };

/** Where a best-of-3 screen is: the rules first, then the steps a link can name. */
export type SeriesScreenStep = 'rules' | SeriesStep;

export type Screen = Route['screen'];

/** Names a screen that isn't a match or a series: `?view=pick`, `?view=manual`. */
const VIEW = 'view';
const BALL = 'ball';
/** The ruleset a replay link was made under (ADR 0022); written by writeMatchParams and series links. */
const VERSION = 'v';
const TAB = 'tab';

/** The ball manual: the roster, one ball's entry, or the matchup chart. Nothing else in the URL. */
export function writeManualParams(
  params: URLSearchParams,
  page: { readonly ball?: string; readonly chart?: boolean } = {},
): void {
  for (const key of [...params.keys()]) params.delete(key);
  params.set(VIEW, 'manual');
  if (page.ball !== undefined) params.set(BALL, page.ball);
  else if (page.chart === true) params.set(TAB, 'chart');
}

/** Other modes (ADR 0046): `?view=modes`, nothing else. */
export function writeModesParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
  params.set(VIEW, 'modes');
}

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

/** A replay link made under another ruleset, rewritten to play under this page's (ADR 0022). */
export function writeTodaysRuleset(params: URLSearchParams): void {
  params.set(VERSION, String(RULESET_VERSION));
}

/** The home screen: a URL with no parameters at all. */
export function writeHomeParams(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
}

/**
 * Reads the screen a URL asks for. Never throws: anything it can't use falls back. A series link is
 * replayed only if `verifySeries` (the same check a server runs, ADR 0022) accepts it; otherwise
 * it opens the lineup step, prefilled with what the link holds, like any other incomplete link.
 * `verify` false skips that replay, for reading only which screen a URL is on (history-rules.ts).
 */
export function parseRoute(
  params: URLSearchParams,
  definitions: DefinitionLookup,
  verify = true,
): Route {
  const validIds = [...definitions.keys()];
  const view = params.get(VIEW)?.trim().toLowerCase();
  if (view === 'modes') return { screen: 'modes' };
  if (view === 'pick') return { screen: 'pick', matchup: parseMatchup(params, validIds) };
  if (view === 'manual') {
    const ball = params.get(BALL)?.trim().toLowerCase();
    return {
      screen: 'manual',
      ball: ball !== undefined && validIds.includes(ball) ? ball : undefined,
      chart: params.get(TAB)?.trim().toLowerCase() === 'chart',
    };
  }
  const parsed = parseSeriesParams(params, validIds);
  if (parsed !== undefined) {
    const made = parsed.setup?.ruleset ?? parsed.retiredFrom;
    if (made !== undefined && made !== RULESET_VERSION) {
      return { screen: 'outdated', kind: 'series', made };
    }
    const link = verify ? replayable(parsed, definitions) : parsed;
    const step =
      link.setup !== undefined ? 'play' : (link.step ?? (link.lineup ? 'lineup' : 'rules'));
    return { screen: 'series', link, step };
  }
  if (!['a', 'b', 'seed'].some((key) => params.has(key))) return { screen: 'home' };
  const seed = parseSeed(params.get('seed'));
  // Without a seed a new match is played, so there is nothing to replay and no version to check.
  const made = parseVersion(params.get(VERSION));
  if (seed !== undefined && made !== RULESET_VERSION) {
    return { screen: 'outdated', kind: 'match', made };
  }
  return { screen: 'match', matchup: parseMatchup(params, validIds), seed };
}

/** The link as it can be played: its setup dropped (leaving the lineup and format) if invalid. */
function replayable(link: SeriesLink, definitions: DefinitionLookup): SeriesLink {
  const { setup } = link;
  if (setup === undefined || verifySeries(setup, definitions).ok) return link;
  return {
    lineup: setup.a,
    ...(setup.format === undefined ? {} : { format: setup.format }),
    ...(setup.bestOf === undefined ? {} : { bestOf: setup.bestOf }),
  };
}
