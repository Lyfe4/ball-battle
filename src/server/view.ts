// `viewOf` (ADR 0052, "What a player is sent"): the one function that decides what a player sees
// of a series. Pure, and tested per format at every step: nothing seed-shaped before its lock,
// no pick the format hides, and in Blind no opponent lineup until the end.
import type { SeedCommitment, SeedReveal, SeriesStatus, SeriesView, Turn } from '../api/series.ts';
import { AWAY_AFTER_MS, START_WINDOW_MS, type LiveView } from '../api/live.ts';
import type { BestOf, Format, PickRecord, RoundRecord, SeriesSetup, Side } from '../sim/index.ts';
import type { LiveClock } from './db/series-record.ts';
import { forfeitAtOf } from './live.ts';

/** One stored seed: its commitment always; its seed and salt only once revealed. */
export interface SeedRow extends SeedCommitment {
  readonly salt: string;
  readonly seed: number | null;
}

/** Everything stored about a series, as the view needs it. */
export interface SeriesRecord {
  readonly id: string;
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly names: Readonly<Record<Side, string | null>>;
  readonly lineups: Readonly<Record<Side, readonly string[]>>;
  readonly picks: readonly PickRecord[];
  readonly rounds: readonly RoundRecord[];
  readonly seeds: readonly SeedRow[];
  readonly turn: Turn | null;
  readonly deadline: Date | null;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly version: number;
  readonly final: SeriesSetup | null;
  /** A live series' clock (ADR 0053); null or absent for a series by turns. */
  readonly live?: LiveClock | null;
}

const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/**
 * Whether `viewer` may see a pick: their own always; the opponent's once its round is played, or
 * at once when the format shows it (a Reveal or Showdown show, which the other side answers).
 * Showdown's round 1 is the one blind pick: both open at once, neither seeing the other's.
 */
function visible(record: SeriesRecord, viewer: Side, pick: PickRecord): boolean {
  if (pick.side === viewer || pick.round < record.rounds.length) return true;
  return !(record.format === 'showdown' && pick.round === 0);
}

export function viewOf(record: SeriesRecord, viewer: Side): SeriesView {
  const ended = record.status !== 'open';
  const hideLineup = record.format === 'blind' && !ended;
  return {
    id: record.id,
    kind: 'friend',
    ruleset: record.ruleset,
    format: record.format,
    bestOf: record.bestOf,
    you: viewer,
    names: record.names,
    lineups: {
      a: hideLineup && viewer !== 'a' ? null : record.lineups.a,
      b: hideLineup && viewer !== 'b' ? null : record.lineups.b,
    },
    picks: record.picks.filter((pick) => visible(record, viewer, pick)),
    rounds: record.rounds,
    commitments: record.seeds.map(({ purpose, index, commitment }) => ({
      purpose,
      index,
      commitment,
    })),
    revealed: record.seeds.flatMap(({ purpose, index, commitment, salt, seed }): SeedReveal[] =>
      seed === null ? [] : [{ purpose, index, commitment, seed, salt }],
    ),
    turn: record.turn,
    deadline: record.deadline?.toISOString() ?? null,
    status: record.status,
    winner: record.winner,
    version: record.version,
    final: record.status === 'finished' ? record.final : null,
    live: record.live == null ? null : liveViewOf(record.live, record.status === 'open', viewer),
  };
}

/**
 * The live clock a player sees: the times the server set, and whether their opponent has gone
 * quiet (shown after AWAY_AFTER_MS, with when they lose). Never the viewer's own presence.
 */
function liveViewOf(clock: LiveClock, open: boolean, viewer: Side): LiveView {
  const seen = clock.seen[other(viewer)];
  const away =
    open && clock.startedAt !== null && seen !== null && clock.now - seen >= AWAY_AFTER_MS
      ? { since: seen, forfeitAt: forfeitAtOf(seen) }
      : null;
  return {
    startedAt: clock.startedAt,
    startBy: clock.createdAt + START_WINDOW_MS,
    opensAt: clock.opensAt,
    fights: clock.fights,
    auto: clock.auto,
    away,
    endReason: clock.endReason,
  };
}

/** The side a player is on, if they play in the series. */
export function sideOf(
  players: Readonly<Record<Side, string | null>>,
  userId: string,
): Side | undefined {
  if (players.a === userId) return 'a';
  if (players.b === userId) return 'b';
  return undefined;
}

export { other };
