// An online series as the existing series screens read it (ADR 0052), as pure functions. The
// server holds the series; the page turns its view into the sim's SeriesState at the point this
// device has watched up to, so each round the player hasn't seen is fought again on the arena from
// its revealed seed (the replay is the player's own check of the server's result). Seats say who
// the player is; `due` is whose turn the server says it is (Showdown's opener is due from both).
import { isCommitted } from '../api/fairness.ts';
import type { SeriesView } from '../api/series.ts';
import { replaysHere } from '../sim/ruleset.ts';
import {
  nextMatch,
  recordOutcome,
  type SeriesSetup,
  type SeriesState,
  type Side,
} from '../sim/series.ts';
import type { SeriesSession } from './series-session.ts';
import { verifySeries } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { otherSide, playerSeats, type Seats } from '../ui/series/seats.ts';

/** The setup as far as the player knows it: the seeds revealed so far, in round order. */
export function knownSetup(view: SeriesView): SeriesSetup {
  const revealed = (purpose: string, index: number) =>
    view.revealed.find((seed) => seed.purpose === purpose && seed.index === index)?.seed;
  const rounds: number[] = [];
  for (let round = 0; round < view.bestOf; round += 1) {
    const seed = revealed('round', round);
    if (seed === undefined) break;
    rounds.push(seed);
  }
  const toss = revealed('toss', 0);
  return {
    ruleset: view.ruleset,
    seed: 0,
    a: view.lineups.a ?? [],
    b: view.lineups.b ?? [],
    opponent: { kind: 'player' },
    ...(view.format === 'blind' ? {} : { format: view.format }),
    ...(view.bestOf === 3 ? {} : { bestOf: view.bestOf }),
    seeds: { rounds, ...(toss === undefined ? {} : { toss }) },
  };
}

/**
 * The series after the first `watched` rounds, with the picks of the round after them: what the
 * screens show before the player watches the rest. At `watched` = every round played, it is the
 * series as it stands (decided when the server says so, a forfeit included).
 */
export function stateAt(view: SeriesView, watched: number): SeriesState {
  const seen = Math.min(watched, view.rounds.length);
  const all = seen === view.rounds.length;
  return {
    setup: knownSetup(view),
    rounds: view.rounds.slice(0, seen),
    pending: [],
    winner: all && view.status !== 'open' ? (view.winner ?? undefined) : undefined,
    picks: view.picks.filter((pick) => pick.round <= seen),
  };
}

/**
 * The series after `watched` rounds and the first `attempt` attempts of the next one (each a draw,
 * fought again): where a live page fights an attempt that comes after a draw (ADR 0053).
 */
export function stateAtAttempt(view: SeriesView, watched: number, attempt: number): SeriesState {
  let state = stateAt(view, watched);
  const outcomes = view.rounds[watched]?.outcomes ?? [];
  for (const outcome of outcomes.slice(0, attempt)) state = recordOutcome(state, outcome);
  return state;
}

export const seatsOf = (view: SeriesView): Seats =>
  playerSeats(view.you, view.names[otherSide(view.you)]);

/** The session at `seen` rounds watched: the next one to watch on the arena, if any. */
export function sessionOf(view: SeriesView, seen: number): SeriesSession {
  const state = stateAt(view, seen);
  const current = seen < view.rounds.length ? nextMatch(state) : undefined;
  return { state, current, recorded: false, replay: undefined };
}

/** The health bars' labels, side A's first: "You" on the player's side, the other's name. */
export function sidesOf(view: SeriesView): readonly string[] {
  const { them } = seatsOf(view);
  return view.you === 'a' ? ['You', them] : [them, 'You'];
}

/** The sides whose turn the server says it is. */
export const dueOf = (view: SeriesView): readonly Side[] =>
  view.turn === null ? [] : view.turn === 'both' ? ['a', 'b'] : [view.turn];

/** "23 h left", "40 min left": the time left on a turn, rounded down, never negative. */
export function timeLeft(deadline: string | null, now: number): string | undefined {
  if (deadline === null) return undefined;
  const minutes = Math.max(0, Math.floor((Date.parse(deadline) - now) / 60_000));
  return minutes >= 60
    ? `${String(Math.floor(minutes / 60))} h left`
    : `${String(minutes)} min left`;
}

/**
 * The fair-play check at the end (ADR 0051, 0052 "The end"): every seed revealed matches the
 * commitment published when the series started, and this page's own replay of the final setup
 * reaches the server's rounds. `unavailable` when there is nothing to check (a forfeit or a void
 * series) or this page plays another ruleset than the series'.
 */
export type FairPlay = 'fair' | 'unfair' | 'unavailable';

export async function fairPlayOf(view: SeriesView, lookup: DefinitionLookup): Promise<FairPlay> {
  if (view.status !== 'finished' || view.final === null || !replaysHere(view.ruleset)) {
    return 'unavailable';
  }
  if (view.revealed.length !== view.commitments.length) return 'unfair';
  const checks = await Promise.all(view.revealed.map((seed) => isCommitted(seed)));
  if (!checks.every(Boolean)) return 'unfair';
  const final = view.final;
  const ownSeed = (purpose: string, index: number) =>
    view.revealed.find((seed) => seed.purpose === purpose && seed.index === index)?.seed;
  // The final setup must use exactly the committed seeds.
  const seeds = final.seeds;
  if (
    seeds === undefined ||
    seeds.rounds.some((seed, index) => seed !== ownSeed('round', index)) ||
    seeds.toss !== ownSeed('toss', 0)
  ) {
    return 'unfair';
  }
  const verdict = verifySeries(final, lookup);
  if (!verdict.ok || verdict.state.winner !== view.winner) return 'unfair';
  return JSON.stringify(verdict.state.rounds) === JSON.stringify(view.rounds) ? 'fair' : 'unfair';
}

/** A replayed round that differs from the server's is a determinism bug to hear about. */
export function reportReplay(view: SeriesView, record: unknown, played: number): void {
  const server = view.rounds[played - 1];
  // The server's result stands.
  if (JSON.stringify(record) !== JSON.stringify(server)) {
    console.error(
      `Series ${view.id} round ${String(played)}: the replay disagreed`,
      JSON.stringify(record),
      JSON.stringify(server),
    );
  }
}
