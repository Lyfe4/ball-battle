// Lineups picked together (ADR 0080), shared by the server and the page. Once a live challenge is
// accepted, or both players say yes to a rematch, both build their lineups at once against one
// clock, each in secret: a start. Each phone sees whether the other is still choosing or ready,
// never their balls. When both are locked in, or the clock runs out, the server makes the series
// (and only then its seeds, ADR 0051): a lineup still being built is finished at random, and a
// player who never opened the lineup loses by `start_missed`. Every time is the database's.
import type { BestOf, Format, Side } from '../sim/index.ts';
import { lineupOf } from './challenges.ts';

/** From the agreement, both lineups must be in within this long. */
export function startLineupMs(bestOf: BestOf): number {
  return bestOf === 5 ? 75_000 : 60_000;
}

/** GET /api/v1/starts/:id, and every answer of POST to it. */
export interface StartView {
  readonly id: string;
  readonly you: Side;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The other player's name; null when they have been deleted. */
  readonly they: string | null;
  /** When the lineups are due, ms since the epoch. */
  readonly deadline: number;
  /** The database's clock at the read. */
  readonly now: number;
  /** The viewer's own lineup as the server holds it: the draft so far, or the locked lineup. */
  readonly draft: readonly string[];
  /** The draft sequence the server holds, so a reload carries on counting from it. */
  readonly seq: number;
  /** The viewer's lineup is locked in. */
  readonly locked: boolean;
  /** The other player's lineup is locked in (never which balls). */
  readonly theirsLocked: boolean;
  /** The series, once made. */
  readonly seriesId: string | null;
  /** Sides whose lineup the clock finished at random, once made. */
  readonly filled: readonly Side[];
  /** Sides that never opened the lineup and lost by `start_missed`, once made. */
  readonly missed: readonly Side[];
  /** The ended live series this start is a rematch of, if it is one. */
  readonly rematchOf: string | null;
}

/**
 * POST /api/v1/starts/:id: the lineup so far (`lock` false, any length up to `bestOf`, sent on
 * every change with a rising `seq`), or the whole lineup locked in (`lock` true). A draft older than
 * the one held changes nothing; nothing changes once locked.
 */
export interface StartMove {
  readonly lineup: readonly string[];
  readonly lock: boolean;
  readonly seq: number;
}

export function decodeStartMove(body: unknown): StartMove | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const fields = body as Record<string, unknown>;
  const lineup = lineupOf(fields['lineup']);
  const { lock, seq } = fields;
  if (lineup === undefined || typeof lock !== 'boolean') return undefined;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 0) return undefined;
  return { lineup, lock, seq };
}

const sideOf = (value: unknown): Side | undefined =>
  value === 'a' || value === 'b' ? value : undefined;
const sidesOf = (value: unknown): Side[] | undefined =>
  Array.isArray(value) && value.every((one) => sideOf(one) !== undefined)
    ? (value as Side[])
    : undefined;
const stringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

/** A start's view from the server; undefined for anything else. Never throws. */
export function decodeStartView(body: unknown): StartView | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const raw = body as Record<string, unknown>;
  const you = sideOf(raw['you']);
  const format = raw['format'] === 'reveal' || raw['format'] === 'showdown' ? raw['format'] : null;
  const bestOf = raw['bestOf'] === 3 || raw['bestOf'] === 5 ? raw['bestOf'] : null;
  const draft = lineupOf(raw['draft']);
  const filled = sidesOf(raw['filled']);
  const missed = sidesOf(raw['missed']);
  const { id, they, deadline, now, seq, locked, theirsLocked, seriesId, rematchOf } = raw;
  if (
    typeof id !== 'string' ||
    you === undefined ||
    format === null ||
    bestOf === null ||
    draft === undefined ||
    filled === undefined ||
    missed === undefined ||
    !stringOrNull(they) ||
    typeof deadline !== 'number' ||
    typeof now !== 'number' ||
    typeof seq !== 'number' ||
    typeof locked !== 'boolean' ||
    typeof theirsLocked !== 'boolean' ||
    !stringOrNull(seriesId) ||
    !stringOrNull(rematchOf)
  ) {
    return undefined;
  }
  return {
    id,
    you,
    format,
    bestOf,
    they,
    deadline,
    now,
    draft,
    seq,
    locked,
    theirsLocked,
    seriesId,
    filled,
    missed,
    rematchOf,
  };
}
