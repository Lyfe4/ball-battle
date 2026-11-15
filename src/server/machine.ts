// The series machine (ADR 0052, "A turn on the server"), pure: no database, no clock. A series by
// turns is stored as its lineups, its locked picks and the rounds the server played; this module
// rebuilds the sim's SeriesState from them with the series' own frozen sim, says whose turn it is,
// plays every round that needs no more picks, and finishes the series through verifySeries. Every
// format runs on the one machine: the sim's `awaitingPick` already knows whose turn it is.
import type {
  BestOf,
  Format,
  PickRecord,
  RoundRecord,
  SeriesSeeds,
  SeriesSetup,
  SeriesState,
  Side,
} from '../sim/index.ts';
import type { FrozenSim } from './rulesets.ts';

/** A series as stored, with every seed (derived from the key, so secret ones included). */
export interface StoredSeries {
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly a: readonly string[];
  readonly b: readonly string[];
  readonly seeds: SeriesSeeds;
  /** Every locked pick, in any order: the machine applies them in the format's turn order. */
  readonly picks: readonly PickRecord[];
  /** Every round already played, in order. */
  readonly rounds: readonly RoundRecord[];
}

/** Who must pick next: one side, both at once (Showdown's round 1), or nobody. */
export type Turn = Side | 'both' | undefined;

/** The SeriesSetup a stored series stands for (picks aside): a player on each side. */
export function setupOf(series: StoredSeries): SeriesSetup {
  return {
    ruleset: series.ruleset,
    // Unused: a server series names all its seeds. Zero, so the setup has one form.
    seed: 0,
    a: series.a,
    b: series.b,
    opponent: { kind: 'player' },
    ...(series.format === 'blind' ? {} : { format: series.format }),
    ...(series.bestOf === 3 ? {} : { bestOf: series.bestOf }),
    seeds: series.seeds,
  };
}

/**
 * The series' state, rebuilt with the sim's own rules: each due pick from the stored ones, each
 * stored round's outcomes in turn. It stops where a pick is missing or a round is unplayed.
 */
export function stateOf(sim: FrozenSim, series: StoredSeries): SeriesState {
  let state = sim.startSeries(setupOf(series));
  for (;;) {
    const due = sim.awaitingPick(state);
    if (due !== undefined) {
      const round = state.rounds.length;
      const pick = series.picks.find((p) => p.round === round && p.side === due);
      if (pick === undefined) return state;
      state = sim.recordPick(state, pick.ball);
      continue;
    }
    const match = sim.nextMatch(state);
    const stored = match === undefined ? undefined : series.rounds[match.round];
    if (match === undefined || stored === undefined) return state;
    for (const outcome of stored.outcomes) state = sim.recordOutcome(state, outcome);
  }
}

/** The sides that may lock a pick now, and in which round. */
export function dueOf(
  sim: FrozenSim,
  series: StoredSeries,
  state: SeriesState,
): { readonly round: number; readonly sides: readonly Side[] } {
  const round = state.rounds.length;
  const due = sim.awaitingPick(state);
  if (due === undefined) return { round, sides: [] };
  // Showdown's round 1: both pick at once, each without seeing the other's (ADR 0035). The sim
  // records A's first, so B may lock before A while the sim waits on A.
  if (series.format === 'showdown' && round === 0) {
    const missing = (['a', 'b'] as const).filter(
      (side) => !series.picks.some((p) => p.round === 0 && p.side === side),
    );
    return { round, sides: missing };
  }
  return { round, sides: [due] };
}

export const turnOf = (sides: readonly Side[]): Turn => (sides.length === 2 ? 'both' : sides[0]);

/**
 * Plays every round that needs no more picks (all of Blind; Reveal's and Showdown's last round),
 * with the series' frozen sim, draws and sudden death included. Returns the rounds it played and,
 * for each, every attempt's length in ticks (a live fight's watching time, ADR 0053).
 */
export function playDue(
  sim: FrozenSim,
  from: SeriesState,
): { state: SeriesState; played: RoundRecord[]; ticks: number[][] } {
  let state = from;
  const played: RoundRecord[] = [];
  const ticks: number[][] = [];
  let attempts: number[] = [];
  for (;;) {
    if (state.winner !== undefined || sim.awaitingPick(state) !== undefined) break;
    const match = sim.nextMatch(state);
    if (match === undefined) break;
    const end = sim.playToEnd(sim.matchWorld(match));
    if (end.match.status !== 'finished') throw new Error('A match ended without a result');
    attempts.push(end.tick);
    const rounds = state.rounds.length;
    state = sim.recordOutcome(state, sim.outcomeOf(end.match.result, end));
    const record = state.rounds[rounds];
    if (record !== undefined) {
      played.push(record);
      ticks.push(attempts);
      attempts = [];
    }
  }
  return { state, played, ticks };
}

/**
 * The finished series checked by verifySeries under its own ruleset: the full setup (every seed
 * and pick), or why it fails. The server built the series itself, so a failure is a bug: the
 * series is void and reported.
 */
export function verifyFinished(
  sim: FrozenSim,
  state: SeriesState,
):
  | { readonly ok: true; readonly setup: SeriesSetup }
  | { readonly ok: false; readonly reason: string } {
  const setup = sim.setupWithPicks(state);
  const verdict = sim.verifySeries(setup);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  if (verdict.state.winner !== state.winner) {
    return { ok: false, reason: 'verifySeries found another winner' };
  }
  return { ok: true, setup };
}
