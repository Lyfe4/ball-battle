// A rematch after a live friend match (ADR 0055), shared by the server and the page. Either
// player asks from the end screen; the other has REMATCH_ANSWER_MS to say yes or no. Once both
// agree, both pick their lineups together (a start, `startId`, ADR 0080), and the server starts a
// new live match between the same two players, in the same format and length, with new seeds. A
// no, or the ask running out, ends it for both. Every time is the database's; the page only
// counts down.
import type { Side } from '../sim/index.ts';
import { lineupOf } from './challenges.ts';

/** From the ask, the other player has this long to answer. */
export const REMATCH_ANSWER_MS = 30_000;
/** A rematch can be asked for this long after the match ended. */
export const REMATCH_OFFER_MS = 120_000;

/**
 * `none`: nobody has asked (`offered` says whether one can be). `asked`: one player asked, the
 * other hasn't answered. `agreed`: both said yes; lineups are being picked (`startId`). `started`:
 * the new match (`seriesId`). `declined` and `expired`: it ended, a no or the ask out of time.
 */
export type RematchState = 'none' | 'asked' | 'agreed' | 'started' | 'declined' | 'expired';

/** GET /api/v1/series/:id/rematch, and every answer of POST to it. */
export interface RematchView {
  readonly state: RematchState;
  /** Who asked. */
  readonly askedBy: Side | null;
  /** Who said no. */
  readonly declinedBy: Side | null;
  /** When the current wait ends (the answer, or the lineups), ms since the epoch; null if none. */
  readonly deadline: number | null;
  /** The database's clock at the read. */
  readonly now: number;
  /** The viewer's new lineup is in (`agreed`): they wait for the other's. */
  readonly lineupIn: boolean;
  /** The new match, once `started`. */
  readonly seriesId: string | null;
  /** `none` and a rematch may be asked now: a live match that ended in the last two minutes. */
  readonly offered: boolean;
  /** The lineups picked together once both said yes (ADR 0080). */
  readonly startId: string | null;
}

/**
 * POST /api/v1/series/:id/rematch: ask or answer (yes or no). {lineup} is the last release's page
 * handing in its new lineup, taken for one release (ADR 0080).
 */
export type RematchRequest =
  { readonly answer: 'yes' | 'no' } | { readonly lineup: readonly string[] };

export function decodeRematchRequest(body: unknown): RematchRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const fields = body as Record<string, unknown>;
  const answer = fields['answer'];
  if (answer === 'yes' || answer === 'no') return { answer };
  const lineup = lineupOf(fields['lineup']);
  return lineup === undefined ? undefined : { lineup };
}

const STATES: readonly RematchState[] = [
  'none',
  'asked',
  'agreed',
  'started',
  'declined',
  'expired',
];
const sideOrNull = (value: unknown): Side | null | undefined =>
  value === 'a' || value === 'b' ? value : value === null ? null : undefined;
const numberOrNull = (value: unknown): number | null | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : value === null ? null : undefined;

/** A rematch view from the server; undefined for anything else. Never throws. */
export function decodeRematchView(body: unknown): RematchView | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const raw = body as Record<string, unknown>;
  const state = STATES.find((one) => one === raw['state']);
  const askedBy = sideOrNull(raw['askedBy']);
  const declinedBy = sideOrNull(raw['declinedBy']);
  const deadline = numberOrNull(raw['deadline']);
  const now = raw['now'];
  const seriesId = raw['seriesId'];
  const startId = raw['startId'];
  if (
    state === undefined ||
    askedBy === undefined ||
    declinedBy === undefined ||
    deadline === undefined ||
    typeof now !== 'number' ||
    typeof raw['lineupIn'] !== 'boolean' ||
    typeof raw['offered'] !== 'boolean' ||
    !(seriesId === null || typeof seriesId === 'string') ||
    !(startId === null || typeof startId === 'string')
  ) {
    return undefined;
  }
  return {
    state,
    askedBy,
    declinedBy,
    deadline,
    now,
    lineupIn: raw['lineupIn'],
    seriesId,
    offered: raw['offered'],
    startId,
  };
}
