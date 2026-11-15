// A series by turns as a player is sent it (ADR 0052, "What a player is sent"), and the requests
// that move it. Shared by the server (which builds views) and the client (which plays them).
// Nothing seed-shaped is in a view before its lock: only commitments, and the seeds and salts the
// server has revealed.
import type { BestOf, Format, PickRecord, RoundRecord, SeriesSetup, Side } from '../sim/index.ts';

/** What a seed is for: a round's seed (index 0-4) or Reveal's toss. */
export type SeedPurpose = 'round' | 'toss' | 'lineup' | 'bot';

export interface SeedCommitment {
  readonly purpose: SeedPurpose;
  readonly index: number;
  /** SHA-256 of the seed and its salt, hex (`src/api/fairness.ts`). */
  readonly commitment: string;
}

export interface SeedReveal extends SeedCommitment {
  readonly seed: number;
  /** 16 bytes, hex. */
  readonly salt: string;
}

export type SeriesStatus = 'open' | 'finished' | 'forfeit' | 'void';
export type Turn = Side | 'both';

export interface SeriesView {
  readonly id: string;
  readonly kind: 'friend';
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The viewer's side. */
  readonly you: Side;
  /** Each side's name; null for a deleted player ("Deleted player"). */
  readonly names: Readonly<Record<Side, string | null>>;
  /** Each side's lineup; the opponent's is null in Blind until the series ends. */
  readonly lineups: Readonly<Record<Side, readonly string[] | null>>;
  /** The picks the viewer may see: their own, every shown ball, and every played round's. */
  readonly picks: readonly PickRecord[];
  /** Every round the server played, with its seeds (revealed by then). */
  readonly rounds: readonly RoundRecord[];
  readonly commitments: readonly SeedCommitment[];
  readonly revealed: readonly SeedReveal[];
  /** Who must pick next, if anyone. */
  readonly turn: Turn | null;
  /** When the turn runs out (ISO 8601, database time); a missed turn forfeits the series. */
  readonly deadline: string | null;
  readonly status: SeriesStatus;
  /** Null while open, and when both sides ran out of time. */
  readonly winner: Side | null;
  /** Bumped on every change (the ETag). */
  readonly version: number;
  /** The whole setup once the series is finished and verified: replays it anywhere. */
  readonly final: SeriesSetup | null;
  /** PROTOTYPE (live): the live series' clock. */
  readonly live?: LiveInfo;
}

/**
 * PROTOTYPE (live, ADR 0053 draft): a live series' clock. Times are milliseconds since the epoch
 * by the database's clock; `now` is when this view was read, so the page can tell its own clock's
 * offset. Each played round fights at `at` on both screens; the next pick opens at its `endsAt`.
 */
export interface LiveInfo {
  readonly now: number;
  readonly pickSeconds: number;
  readonly fights: readonly {
    readonly round: number;
    readonly at: number;
    readonly endsAt: number;
  }[];
  /** The opponent stopped asking: since when, and when they lose by forfeit. */
  readonly away: { readonly since: number; readonly forfeitAt: number } | null;
}

/** POST /api/v1/series/:id/picks. */
export interface PickRequest {
  /** 0-based: the round the pick is for, so a stale tab's pick can't land in a later round. */
  readonly round: number;
  readonly ball: string;
}

export function decodePickRequest(body: unknown): PickRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { round, ball } = body as Record<string, unknown>;
  if (typeof round !== 'number' || !Number.isInteger(round) || round < 0 || round > 4) {
    return undefined;
  }
  if (typeof ball !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(ball)) return undefined;
  return { round, ball };
}

/** One series in the player's list (home's "Your turn"). */
export interface SeriesSummary {
  readonly id: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly you: Side;
  readonly opponent: string | null;
  readonly status: SeriesStatus;
  readonly yourTurn: boolean;
  readonly deadline: string | null;
  readonly winner: Side | null;
  readonly score: Readonly<Record<Side, number>>;
}

/** GET /api/v1/series: open series first (yours to play first), then recently finished. */
export interface SeriesList {
  readonly series: readonly SeriesSummary[];
}
