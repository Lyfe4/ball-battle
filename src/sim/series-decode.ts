// Reading a series setup from outside (ADR 0022): a link, a save, or later a server's request
// body. It is the one decoder of untrusted series data: `verifySeries` runs it first, and the
// browser's save and link code read through it, so a field means the same everywhere. It checks
// the setup's form (every field a known one of the right kind, lineups of different balls from
// the roster, an opponent and format the game knows); whether the picks are legal and the bot's
// are its own is for `verifySeries`, which plays the series. It never throws, and it bounds its
// work before reading a list, so hostile input costs nothing.
import { BOTS } from './bot.ts';
import {
  asBestOf,
  DEFAULT_BEST_OF,
  FORMATS,
  isValidLineup,
  type Opponent,
  type SeriesSetup,
} from './series.ts';

export type DecodedSetup =
  | { readonly ok: true; readonly setup: SeriesSetup }
  | { readonly ok: false; readonly reason: string };

/** Every field a setup may have (SeriesSetup). */
const FIELDS = ['ruleset', 'seed', 'a', 'b', 'opponent', 'format', 'picks', 'bestOf'];

const refuse = (reason: string): DecodedSetup => ({ ok: false, reason });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A 32-bit unsigned integer: a seed, a ruleset, a lineup seed. */
export const isUint32 = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

/** `value` as a list of roster ids no longer than `most`, else undefined. */
function idsOf(value: unknown, roster: readonly string[], most: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > most) return undefined;
  const ids: string[] = [];
  for (const id of value as readonly unknown[]) {
    if (typeof id !== 'string' || !roster.includes(id)) return undefined;
    ids.push(id);
  }
  return ids;
}

function opponentOf(value: unknown): Opponent | string {
  if (!isRecord(value)) return 'Unknown opponent kind';
  const allowed = value['kind'] === 'bot' ? ['kind', 'bot', 'lineupSeed'] : ['kind'];
  if (value['kind'] !== 'bot' && value['kind'] !== 'player') return 'Unknown opponent kind';
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra !== undefined) return `Unknown opponent field "${extra}"`;
  if (value['kind'] === 'player') return { kind: 'player' };
  const { bot, lineupSeed } = value;
  if (typeof bot !== 'string' || !BOTS.has(bot)) return `No bot "${String(bot)}"`;
  if (!isUint32(lineupSeed)) return 'The lineup seed is not a 32-bit integer';
  return { kind: 'bot', bot, lineupSeed };
}

/**
 * The setup `raw` holds, as a fresh object with exactly its fields, or why it isn't one. The
 * roster is the ids a lineup may use, in the order the bot picks from.
 */
export function decodeSeriesSetup(raw: unknown, roster: readonly string[]): DecodedSetup {
  if (!isRecord(raw)) return refuse('The series is not an object');
  const unknown = Object.keys(raw).find((key) => !FIELDS.includes(key));
  if (unknown !== undefined) return refuse(`Unknown field "${unknown}"`);
  const { ruleset, seed, a, b, format, picks, bestOf } = raw;
  if (!isUint32(ruleset)) return refuse('The ruleset is not a 32-bit unsigned integer');
  if (!isUint32(seed)) return refuse('The seed is not a 32-bit unsigned integer');
  // Absent is Best of 3, as every series before ADR 0048.
  const length = bestOf === undefined ? DEFAULT_BEST_OF : asBestOf(bestOf);
  if (length === undefined) return refuse('The series is not Best of 3 or Best of 5');
  const lineupA = idsOf(a, roster, length);
  const lineupB = idsOf(b, roster, length);
  if (
    lineupA === undefined ||
    lineupB === undefined ||
    !isValidLineup(lineupA, roster, length) ||
    !isValidLineup(lineupB, roster, length)
  ) {
    return refuse(`A lineup is not ${String(length)} different balls from the roster`);
  }
  const opponent = opponentOf(raw['opponent']);
  if (typeof opponent === 'string') return refuse(opponent);
  const named = FORMATS.find((name) => name === format);
  if (format !== undefined && named === undefined) return refuse('Unknown format');
  // Both sides pick in every round but the last: no series makes more (series-url.ts).
  const most = 2 * (length - 1);
  if (Array.isArray(picks) && picks.length > most)
    return refuse('More picks than any series makes');
  const made = picks === undefined ? undefined : idsOf(picks, roster, most);
  if (picks !== undefined && made === undefined) {
    return refuse('The picks are not balls from the roster');
  }
  return {
    ok: true,
    setup: {
      ruleset,
      seed,
      a: lineupA,
      b: lineupB,
      opponent,
      ...(named === undefined ? {} : { format: named }),
      ...(made === undefined ? {} : { picks: made }),
      ...(bestOf === undefined ? {} : { bestOf: length }),
    },
  };
}

/** `decodeSeriesSetup` over JSON text, refusing text that isn't JSON. */
export function parseSeriesSetup(json: string, roster: readonly string[]): DecodedSetup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return refuse('The series is not valid JSON');
  }
  return decodeSeriesSetup(raw, roster);
}
