// Series by turns on the server (ADR 0052, "A turn on the server"): creating one with committed
// secret seeds, locking a pick, and moving the series on. Each move is one load and one write: the
// whole series in one query, then every change in one statement guarded by the series' version, so
// one move at a time changes a series on any host (a raced move writes nothing, reloads and tries
// again). The functions may run far from the database, so round trips are what a move costs.
// Every round is played and every finished series verified by the frozen sim of its own ruleset.
import { commitmentOf } from '../api/fairness.ts';
import type { PickRequest, SeriesView } from '../api/series.ts';
import type { BestOf, Format, PickRecord, Side } from '../sim/index.ts';
import { ConfigError, type Config } from './config.ts';
import type { Sql, TransactionSql } from './db.ts';
import { loadSeries, writeSeries, type LoadedSeries, type SeriesMove } from './db/series-record.ts';
import { insertSeriesWithSeeds } from './db/series.ts';
import { ApiError, type Deps } from './http.ts';
import { dueOf, playDue, stateOf, turnOf, verifyFinished, type StoredSeries } from './machine.ts';
import { report } from './monitor.ts';
import { deadlineAfter, fightMsOf, PICK_SECONDS, START_MS } from './live.ts';
import { liveViewOf, settleLive } from './live-service.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { importSeedKey, newSalt, seriesSeeds, type SeedKey } from './seeds.ts';
import { sideOf, viewOf, type SeedRow } from './view.ts';

type Db = Sql | TransactionSql;
/** How often a move that raced another is tried again before giving up. */
const MOST_TRIES = 4;

const keys = new Map<string, Promise<SeedKey>>();
function seedKey(config: Config, id: string): Promise<SeedKey> {
  const raw = config.seedKeys.get(id);
  if (raw === undefined) throw new ConfigError(`SEED_KEYS has no key "${id}" (a series uses it)`);
  let key = keys.get(id);
  if (key === undefined) {
    key = importSeedKey(raw);
    keys.set(id, key);
  }
  return key;
}

/** The series as the machine needs it: every seed re-derived from its key, secret ones too. */
async function storedOf(config: Config, series: LoadedSeries): Promise<StoredSeries> {
  const { seeds } = await seriesSeeds(await seedKey(config, series.keyId), series.id, {
    bestOf: series.bestOf,
    format: series.format,
    bot: false,
  });
  return {
    ruleset: series.ruleset,
    format: series.format,
    bestOf: series.bestOf,
    a: series.lineups.a,
    b: series.lineups.b,
    seeds,
    picks: series.picks,
    rounds: series.rounds,
  };
}

/**
 * The move after `picks` are added: every round that needs no more picks played (their seeds
 * revealed), then whose turn it is, or the series finished through verifySeries (every seed
 * revealed) or void when that fails (a bug: the server built the series, so it is reported).
 */
async function moveOf(
  config: Config,
  series: LoadedSeries,
  picks: readonly PickRecord[],
  keepDeadline: boolean,
  extraSeconds = 0,
): Promise<SeriesMove> {
  const sim = await rulesetSim(series.ruleset);
  const stored = await storedOf(config, { ...series, picks: [...series.picks, ...picks] });
  const { state, played } = playDue(sim, stateOf(sim, stored));
  // PROTOTYPE (live): the next pick is due 30 s after the fights this move started have played.
  const fights = played.map((r) => fightMsOf(sim, `${series.id}:${String(r.round)}`, r, r.a, r.b));
  const deadlineSeconds = played.length > 0 ? deadlineAfter(fights) : PICK_SECONDS + extraSeconds;
  const round = (index: number) => ({
    purpose: 'round',
    index,
    seed: stored.seeds.rounds[index] ?? 0,
  });
  if (state.winner === undefined) {
    return {
      turn: turnOf(dueOf(sim, { ...stored, rounds: state.rounds }, state).sides) ?? null,
      keepDeadline: keepDeadline && played.length === 0,
      deadlineSeconds,
      status: 'open',
      winner: null,
      final: null,
      picks,
      rounds: played,
      reveals: played.map(({ round: index }) => round(index)),
    };
  }
  const verdict = verifyFinished(sim, state);
  if (!verdict.ok) {
    await report(new Error(`Series ${series.id} failed verification: ${verdict.reason}`), {
      route: 'series.advance',
      requestId: series.id,
    });
  }
  const toss = stored.seeds.toss;
  return {
    turn: null,
    keepDeadline: false,
    status: verdict.ok ? 'finished' : 'void',
    winner: verdict.ok ? state.winner : null,
    final: verdict.ok ? verdict.setup : null,
    picks,
    rounds: played,
    // The series is over: every seed it had is public now, played or not.
    reveals: [
      ...stored.seeds.rounds.map((_, index) => round(index)),
      ...(toss === undefined ? [] : [{ purpose: 'toss', index: 0, seed: toss }]),
    ],
  };
}

/** The series as stored after `move` was written at `version`, without reading it again. */
function after(
  series: LoadedSeries,
  move: SeriesMove,
  written: { readonly version: number; readonly deadline: Date | null; readonly at: Date },
): LoadedSeries {
  const revealed = (seed: SeedRow): SeedRow => {
    const shown = move.reveals.find((r) => r.purpose === seed.purpose && r.index === seed.index);
    return seed.seed !== null || shown === undefined ? seed : { ...seed, seed: shown.seed };
  };
  return {
    ...series,
    turn: move.turn,
    deadline: written.deadline,
    status: move.status,
    winner: move.winner,
    final: move.final,
    version: written.version,
    expired: false,
    picks: [...series.picks, ...move.picks.map((p) => ({ ...p, at: written.at.toISOString() }))],
    now: written.at,
    early: move.rounds.length > 0,
    rounds: [...series.rounds, ...move.rounds],
    seeds: series.seeds.map(revealed),
  };
}

export interface SeriesInput {
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly players: Readonly<Record<Side, string>>;
  readonly lineups: Readonly<Record<Side, readonly string[]>>;
}

/**
 * Starts a series between two players under today's ruleset: commits to every seed it will use,
 * reveals Reveal's toss (it decides who shows first), and plays whatever needs no pick (all of a
 * Blind series). Two statements. Returns its id.
 */
export async function createSeries(db: Db, config: Config, input: SeriesInput): Promise<string> {
  const id = crypto.randomUUID();
  const key = config.currentSeedKey;
  const { seeds } = await seriesSeeds(await seedKey(config, key.id), id, {
    bestOf: input.bestOf,
    format: input.format,
    bot: false,
  });
  const values = [
    ...(seeds.toss === undefined ? [] : [{ purpose: 'toss' as const, index: 0, seed: seeds.toss }]),
    ...seeds.rounds.map((seed, index) => ({ purpose: 'round' as const, index, seed })),
  ];
  const rows: SeedRow[] = [];
  for (const { purpose, index, seed } of values) {
    const salt = newSalt();
    rows.push({ purpose, index, salt, commitment: await commitmentOf(seed, salt), seed: null });
  }
  const series: LoadedSeries = {
    id,
    ruleset: CURRENT_RULESET,
    format: input.format,
    bestOf: input.bestOf,
    players: input.players,
    names: { a: null, b: null },
    lineups: input.lineups,
    keyId: key.id,
    status: 'open',
    winner: null,
    version: 0,
    turn: null,
    deadline: null,
    expired: false,
    final: null,
    picks: [],
    rounds: [],
    seeds: rows,
  };
  await insertSeriesWithSeeds(db, { ...series, kind: 'friend' }, rows);
  const move = await moveOf(config, series, [], false, START_MS / 1000);
  const toss = seeds.toss === undefined ? [] : [{ purpose: 'toss', index: 0, seed: seeds.toss }];
  await writeSeries(db, id, 0, { ...move, reveals: [...toss, ...move.reveals] });
  return id;
}

/** A player's view of a loaded series; a 404 for anyone not playing in it. */
function viewFor(series: LoadedSeries | undefined, userId: string): SeriesView {
  const side = series === undefined ? undefined : sideOf(series.players, userId);
  if (series === undefined || side === undefined) {
    throw new ApiError(404, 'not_found', 'No such series');
  }
  return viewOf(series, side);
}

/**
 * A series, settling its turn first if it ran out (settled on read, ADR 0052). `loaded` is the
 * series read alongside the session (one round trip for both); it is read again only after a
 * forfeit was settled.
 */
export async function readSeries(
  deps: Deps,
  id: string,
  userId: string,
  loaded?: LoadedSeries,
): Promise<SeriesView> {
  const series = loaded ?? (await loadSeries(deps.sql, id, userId));
  // PROTOTYPE (live): every friend series is live; a missed pick is picked for the player, and a
  // player gone past the grace period loses by forfeit.
  const side = series === undefined ? undefined : sideOf(series.players, userId);
  if (series === undefined || side === undefined) return viewFor(series, userId);
  const settled = await settleLive(deps, series, side, autoPick);
  return liveViewOf(settled ?? series, side);
}

/**
 * PROTOTYPE (live): a random ball from those left, for every side whose pick ran out. The
 * opponent can't steer it and nothing seed-shaped decides it (crypto randomness). Undefined when
 * another request moved the series first.
 */
export async function autoPick(deps: Deps, series: LoadedSeries): Promise<boolean> {
  const sim = await rulesetSim(series.ruleset);
  const stored = await storedOf(deps.config, series);
  const state = stateOf(sim, stored);
  const due = dueOf(sim, stored, state);
  const picks = due.sides.map((side) => {
    const left = sim.remainingOf(state, side);
    const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
    return { round: due.round, side, ball: left[random % left.length] ?? '' };
  });
  if (picks.length === 0 || picks.some((p) => p.ball === '')) return false;
  const move = await moveOf(deps.config, series, picks, false);
  return (await writeSeries(deps.sql, series.id, series.version, move)) !== undefined;
}

/**
 * Locks a pick (ADR 0052, "A turn on the server"). The first lock of a round and side wins: a
 * retry, a double tap or a second tab gets the series as stored, never a second pick. A pick that
 * isn't due (another round, the opponent's turn, a finished series) is refused, unless it is the
 * very pick already stored. `loaded` is a first read made alongside the session.
 */
export async function lockPick(
  deps: Deps,
  id: string,
  userId: string,
  request: PickRequest,
  loaded?: LoadedSeries,
): Promise<SeriesView> {
  let series = loaded ?? (await loadSeries(deps.sql, id, userId));
  for (let tries = 0; tries < MOST_TRIES; tries += 1) {
    const side = series === undefined ? undefined : sideOf(series.players, userId);
    if (series === undefined || side === undefined) {
      throw new ApiError(404, 'not_found', 'No such series');
    }
    if (series.expired) {
      // PROTOTYPE (live): a pick that ran out is made for the player, then this one is weighed.
      await autoPick(deps, series);
      series = await loadSeries(deps.sql, id, userId);
      continue;
    }
    if (series.picks.some((p) => p.round === request.round && p.side === side)) {
      return liveViewOf(series, side);
    }
    // PROTOTYPE (live): no pick before the pick phase opens on both screens.
    if (series.early === true) {
      throw new ApiError(409, 'not_your_turn', 'The fight is still on: pick when it ends');
    }
    const sim = await rulesetSim(series.ruleset);
    const stored = await storedOf(deps.config, series);
    const state = stateOf(sim, stored);
    const due = dueOf(sim, stored, state);
    if (series.status !== 'open' || request.round !== due.round || !due.sides.includes(side)) {
      throw new ApiError(409, 'not_your_turn', 'This pick is not yours to make now');
    }
    if (!sim.remainingOf(state, side).includes(request.ball)) {
      throw new ApiError(400, 'bad_request', 'That ball is not one you have left');
    }
    const pick = { round: request.round, side, ball: request.ball };
    // Showdown's round 1: the other side's clock keeps running when one side locks first.
    const move = await moveOf(deps.config, series, [pick], due.sides.length === 2);
    const written = await writeSeries(deps.sql, id, series.version, move);
    if (written !== undefined) return liveViewOf(after(series, move, written), side);
    // Another move came first: read the series as it is now and decide again.
    series = await loadSeries(deps.sql, id);
  }
  throw new ApiError(409, 'conflict', 'The series is busy: try again');
}
