// A best-of-3 series in the URL (ADR 0017, 0019): `?mode=bo3&la=a,b,c&lb=d,e,f&seed=N` holds both
// lineups and the series seed; `fmt=reveal` or `fmt=showdown` names a draft format (none is blind),
// a series with picks adds `picks=x,y,...`, every pick in order (ADR 0019, 0021, 0035), and `v=` names
// the ruleset it was played under (ADR 0022). Side B is always a bot: `bot=` names its level
// (ADR 0035; absent is the first bot, which every older link played), its lineup picked from the
// series seed, or from `bs=` after a rematch kept the lineup (ADR 0022). That is everything that decides a series, so the link
// replays it exactly under that ruleset. A link with only `mode=bo3` (and perhaps `fmt`), or with
// anything invalid, opens the lineup builder instead.
import {
  FORMATS,
  isValidLineup,
  LINEUP_SIZE,
  type Format,
  type Lineup,
  type Opponent,
  type SeriesSetup,
} from '../sim/series.ts';
import { randomBot } from '../sim/bot.ts';
import { parseSeed, parseVersion } from './seed.ts';

export const SERIES_MODE = 'bo3';
const KEYS = {
  mode: 'mode',
  a: 'la',
  b: 'lb',
  seed: 'seed',
  format: 'fmt',
  picks: 'picks',
  step: 'step',
  version: 'v',
  lineupSeed: 'bs',
  bot: 'bot',
} as const;

/**
 * Retired formats a link may still name, and the format that replaced each. Such a link can't
 * replay under today's rules, so it opens the lineup step with its replacement chosen (ADR 0035).
 */
const RETIRED_FORMATS: Readonly<Record<string, Format>> = { loser: 'showdown' };

/**
 * The best-of-3 setup step a URL is on, past the first (choosing the rules). Only a link that holds
 * a whole series replays one; the others are steps of setting one up, and `answer` and `play` fall
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
  /**
   * A whole series in a retired format (ADR 0035): the ruleset it was played under, so the route
   * shows the older-link notice before the lineup step, as for any other old replay link.
   */
  readonly retiredFrom?: number;
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

/** The format a retired format's link prefills the lineup step with, if it names one. */
function replacementFormat(raw: string | null): Format | undefined {
  return RETIRED_FORMATS[raw?.trim().toLowerCase() ?? ''];
}

/** Picks a whole series of each format records (ADR 0019, 0021); a blind series has none. */
const PICKS: Readonly<Record<Format, { readonly min: number; readonly max: number }>> = {
  blind: { min: 0, max: 0 },
  // Reveal and Showdown: both sides pick in rounds 1 and 2, and a series is never decided before
  // round 2.
  reveal: { min: 4, max: 4 },
  showdown: { min: 4, max: 4 },
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
  const format = readFormat(params.get(KEYS.format)) ?? replacementFormat(params.get(KEYS.format));
  const retired = replacementFormat(params.get(KEYS.format)) !== undefined;
  const stepName = params.get(KEYS.step)?.trim().toLowerCase();
  const step = STEPS.find((name) => name === stepName);
  const named = {
    ...(format === undefined || format === 'blind' ? {} : { format }),
    ...(step === undefined ? {} : { step }),
  };
  if (
    a !== undefined &&
    b !== undefined &&
    seed !== undefined &&
    format !== undefined &&
    !retired
  ) {
    const picks = readPicks(params.get(KEYS.picks), a, b);
    // A reveal link from before ADR 0021 has no picks: it can't replay under the new rules, so it
    // falls back to the lineup, prefilled, like any other link that doesn't hold a whole series.
    const { min, max } = PICKS[format];
    const valid = picks !== undefined && picks.length >= min && picks.length <= max;
    if (valid) {
      const extra = format === 'blind' ? {} : { format };
      const withPicks = picks.length > 0 ? { picks } : {};
      const ruleset = parseVersion(params.get(KEYS.version));
      // Every link is against the bot; its lineup seed is the series seed unless a rematch
      // kept the lineup it picked for an earlier series (ADR 0022).
      const rawLineupSeed = params.get(KEYS.lineupSeed);
      const lineupSeed = rawLineupSeed === null ? seed : parseSeed(rawLineupSeed);
      // The bot's level; a link from before levels played the first bot. An unknown level is
      // kept, so `verifySeries` refuses the link rather than replaying another bot's series.
      const named = params.get(KEYS.bot)?.trim().toLowerCase() ?? '';
      const bot = named === '' ? randomBot.id : named;
      if (lineupSeed !== undefined) {
        const opponent: Opponent = { kind: 'bot', bot, lineupSeed };
        return { setup: { ruleset, seed, a, b, opponent, ...extra, ...withPicks } };
      }
    }
  }
  const whole = retired && a !== undefined && b !== undefined && seed !== undefined;
  const from = whole ? { retiredFrom: parseVersion(params.get(KEYS.version)) } : {};
  return a === undefined ? named : { lineup: a, ...named, ...from };
}

/** Writes a whole series into URL parameters, replacing any quick-match ones. */
export function writeSeriesParams(params: URLSearchParams, setup: SeriesSetup): void {
  writeSeriesModeParams(params, setup.format);
  params.delete(KEYS.step);
  params.set(KEYS.a, setup.a.join(','));
  params.set(KEYS.b, setup.b.join(','));
  params.set(KEYS.seed, String(setup.seed));
  params.set(KEYS.version, String(setup.ruleset));
  const { opponent } = setup;
  if (opponent.kind === 'bot' && opponent.lineupSeed !== setup.seed) {
    params.set(KEYS.lineupSeed, String(opponent.lineupSeed));
  }
  // The first bot is what a link without `bot=` means, so its links stay as they were.
  if (opponent.kind === 'bot' && opponent.bot !== randomBot.id) params.set(KEYS.bot, opponent.bot);
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
  params.delete(KEYS.version);
  params.delete(KEYS.lineupSeed);
  params.delete(KEYS.bot);
}

function clearMatchParams(params: URLSearchParams): void {
  params.delete('a');
  params.delete('b');
  params.delete(KEYS.a);
  params.delete(KEYS.b);
  params.delete(KEYS.seed);
  params.delete(KEYS.format);
  params.delete(KEYS.picks);
  params.delete(KEYS.version);
  params.delete(KEYS.lineupSeed);
  params.delete(KEYS.bot);
}
