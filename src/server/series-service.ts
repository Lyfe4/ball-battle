// Series by turns on the server (ADR 0052, "A turn on the server"): creating one with committed
// secret seeds, locking a pick, and moving the series on, each in one transaction that holds the
// series row (`FOR UPDATE`), so one request at a time changes a series on any host. Every round is
// played and every finished series verified by the frozen sim of the series' own ruleset.
import { commitmentOf } from '../api/fairness.ts';
import type { PickRequest, SeriesView } from '../api/series.ts';
import type { BestOf, Format, Side } from '../sim/index.ts';
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import {
  insertPick,
  insertRound,
  insertSeeds,
  insertSeries,
  picksOf,
  revealSeeds,
  roundsOf,
  seedsOf,
  seriesById,
  settleExpired,
  updateSeries,
  type SeriesRow,
} from './db/series.ts';
import { ApiError, type Deps } from './http.ts';
import { dueOf, playDue, stateOf, turnOf, verifyFinished, type StoredSeries } from './machine.ts';
import { report } from './monitor.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { importSeedKey, newSalt, seriesSeeds, type SeedKey } from './seeds.ts';
import { sideOf, viewOf, type SeedRow } from './view.ts';

const keys = new Map<string, Promise<SeedKey>>();
function seedKey(config: Config, id: string): Promise<SeedKey> {
  const raw = config.seedKeys.get(id);
  if (raw === undefined) throw new Error(`No seed key "${id}" in SEED_KEYS`);
  let key = keys.get(id);
  if (key === undefined) {
    key = importSeedKey(raw);
    keys.set(id, key);
  }
  return key;
}

/** The series as the machine needs it: every seed re-derived from its key, secret ones too. */
async function storedOf(db: TransactionSql, config: Config, row: SeriesRow): Promise<StoredSeries> {
  const { seeds } = await seriesSeeds(await seedKey(config, row.keyId), row.id, {
    bestOf: row.bestOf,
    format: row.format,
    bot: false,
  });
  return {
    ruleset: row.ruleset,
    format: row.format,
    bestOf: row.bestOf,
    a: row.lineups.a,
    b: row.lineups.b,
    seeds,
    picks: await picksOf(db, row.id),
    rounds: await roundsOf(db, row.id),
  };
}

/**
 * Moves a locked series on after a change: plays every round that needs no more picks, reveals
 * their seeds, and either names whose turn it is or finishes the series through verifySeries. A
 * series that fails verification (a bug: the server built it) is void and reported.
 */
async function advance(db: TransactionSql, config: Config, row: SeriesRow, keepDeadline: boolean) {
  const sim = await rulesetSim(row.ruleset);
  const stored = await storedOf(db, config, row);
  const { state, played } = playDue(sim, stateOf(sim, stored));
  for (const round of played) await insertRound(db, row.id, round);
  const seed = (round: number) => stored.seeds.rounds[round] ?? 0;
  await revealSeeds(
    db,
    row.id,
    played.map(({ round }) => ({ purpose: 'round' as const, index: round, seed: seed(round) })),
  );
  if (state.winner === undefined) {
    const turn = turnOf(dueOf(sim, { ...stored, rounds: state.rounds }, state).sides) ?? null;
    await updateSeries(db, row.id, {
      turn,
      keepDeadline: keepDeadline && played.length === 0,
      status: 'open',
      winner: null,
      final: null,
    });
    return;
  }
  const verdict = verifyFinished(sim, state);
  if (!verdict.ok) {
    await report(new Error(`Series ${row.id} failed verification: ${verdict.reason}`), {
      route: 'series.advance',
      requestId: row.id,
    });
  }
  // The series is over: every seed it had is public now, played or not.
  await revealSeeds(db, row.id, [
    ...stored.seeds.rounds.map((value, index) => ({
      purpose: 'round' as const,
      index,
      seed: value,
    })),
    ...(stored.seeds.toss === undefined
      ? []
      : [{ purpose: 'toss' as const, index: 0, seed: stored.seeds.toss }]),
  ]);
  await updateSeries(db, row.id, {
    turn: null,
    keepDeadline: false,
    status: verdict.ok ? 'finished' : 'void',
    winner: verdict.ok ? state.winner : null,
    final: verdict.ok ? verdict.setup : null,
  });
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
 * Blind series). Returns its id.
 */
export async function createSeries(
  db: TransactionSql,
  config: Config,
  input: SeriesInput,
): Promise<string> {
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
  await insertSeries(db, {
    id,
    kind: 'friend',
    ruleset: CURRENT_RULESET,
    format: input.format,
    bestOf: input.bestOf,
    players: input.players,
    lineups: input.lineups,
    keyId: key.id,
  });
  await insertSeeds(db, id, rows);
  if (seeds.toss !== undefined) {
    await revealSeeds(db, id, [{ purpose: 'toss', index: 0, seed: seeds.toss }]);
  }
  const row = await seriesById(db, id, true);
  if (row === undefined) throw new Error('A series just made is missing');
  await advance(db, config, row, false);
  return id;
}

/** A player's view of a series, read in `db`; a 404 for anyone not playing in it. */
export async function viewFor(db: TransactionSql, id: string, userId: string): Promise<SeriesView> {
  const row = await seriesById(db, id);
  const side = row === undefined ? undefined : sideOf(row.players, userId);
  if (row === undefined || side === undefined) {
    throw new ApiError(404, 'not_found', 'No such series');
  }
  return viewOf(
    {
      ...row,
      picks: await picksOf(db, id),
      rounds: await roundsOf(db, id),
      seeds: await seedsOf(db, id),
    },
    side,
  );
}

/** Reads a series, settling its turn first if it ran out (settled on read, ADR 0052). */
export async function readSeries(deps: Deps, id: string, userId: string): Promise<SeriesView> {
  return deps.sql.begin(async (db) => {
    const row = await seriesById(db, id);
    if (row?.expired === true) await settleExpired(db, id);
    return viewFor(db, id, userId);
  });
}

/**
 * Locks a pick (ADR 0052, "A turn on the server"). The first lock of a round and side wins: a
 * retry, a double tap or a second tab gets the series as stored, never a second pick. A pick that
 * isn't due (another round, the opponent's turn, a finished series) is refused, unless it is the
 * very pick already stored.
 */
export async function lockPick(
  deps: Deps,
  id: string,
  userId: string,
  request: PickRequest,
): Promise<SeriesView> {
  return deps.sql.begin(async (db) => {
    let row = await seriesById(db, id, true);
    const side = row === undefined ? undefined : sideOf(row.players, userId);
    if (row === undefined || side === undefined) {
      throw new ApiError(404, 'not_found', 'No such series');
    }
    if (row.expired) {
      await settleExpired(db, id);
      row = (await seriesById(db, id, true)) ?? row;
    }
    const sim = await rulesetSim(row.ruleset);
    const stored = await storedOf(db, deps.config, row);
    const already = stored.picks.find((p) => p.round === request.round && p.side === side);
    if (already !== undefined) return viewFor(db, id, userId);
    const due = dueOf(sim, stored, stateOf(sim, stored));
    if (row.status !== 'open' || request.round !== due.round || !due.sides.includes(side)) {
      throw new ApiError(409, 'not_your_turn', 'This pick is not yours to make now');
    }
    if (!sim.remainingOf(stateOf(sim, stored), side).includes(request.ball)) {
      throw new ApiError(400, 'bad_request', 'That ball is not one you have left');
    }
    await insertPick(db, id, { round: request.round, side, ball: request.ball });
    // Showdown's round 1: the other side's clock keeps running when one side locks first.
    await advance(db, deps.config, row, due.sides.length === 2);
    return viewFor(db, id, userId);
  });
}
