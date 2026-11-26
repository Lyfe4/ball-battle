// Series on the server (ADR 0052, "A turn on the server"; ADR 0053 for live ones): creating one
// with committed secret seeds, locking a pick, and moving the series on. Each move is one load and
// one write: the whole series in one query, then every change in one statement guarded by the
// series' version, so one move at a time changes a series on any host (a raced move writes
// nothing, reloads and tries again). The functions may run far from the database, so round trips
// are what a move costs. Every round is played and every finished series verified by the frozen
// sim of its own ruleset (series-move.ts).
import { markSeen } from './db/inbox.ts';
import { commitmentOf } from '../api/fairness.ts';
import type { PickRequest, SeriesView } from '../api/series.ts';
import type { BestOf, Format, Side } from '../sim/index.ts';
import type { Config } from './config.ts';
import type { Sql, TransactionSql } from './db.ts';
import { markPresent } from './db/live.ts';
import { loadSeries, type LoadedSeries } from './db/series-record.ts';
import { forfeitSeries, writeSeries } from './db/series-write.ts';
import { insertSeriesWithSeeds, settleExpired } from './db/series.ts';
import { ApiError, type Deps } from './http.ts';
import { settleLive } from './live-service.ts';
import { dueOf, stateOf } from './machine.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { after, moveOf, seedKey, storedOf } from './series-move.ts';
import { newSalt, seriesSeeds } from './seeds.ts';
import { sideOf, viewOf, type SeedRow } from './view.ts';

type Db = Sql | TransactionSql;
/** How often a move that raced another is tried again before giving up. */
const MOST_TRIES = 4;

export interface SeriesInput {
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly players: Readonly<Record<Side, string>>;
  readonly lineups: Readonly<Record<Side, readonly string[]>>;
  /** Played live (ADR 0053): side B, who accepts, is here from the start. */
  readonly live?: boolean;
}

/**
 * Starts a series between two players under today's ruleset: commits to every seed it will use,
 * reveals Reveal's toss (it decides who shows first), and plays whatever needs no pick (all of a
 * Blind series). A live series' first pick phase waits until both players have arrived. Returns
 * its id.
 */
export async function createSeries(db: Db, config: Config, input: SeriesInput): Promise<string> {
  const id = crypto.randomUUID();
  const key = config.currentSeedKey;
  const live = input.live === true;
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
    live: null,
  };
  await insertSeriesWithSeeds(db, { ...series, kind: 'friend', live }, rows);
  const move = await moveOf(config, series, [], false);
  const toss = seeds.toss === undefined ? [] : [{ purpose: 'toss', index: 0, seed: seeds.toss }];
  // Live: no deadline until both have arrived (the start, live-service.ts).
  const timing = live
    ? { live: { opensAt: null, deadline: null, startedAt: null, fights: [] } }
    : {};
  await writeSeries(db, id, 0, { ...move, ...timing, reveals: [...toss, ...move.reveals] });
  if (live) await markPresent(db, id, 'b');
  return id;
}

/** A series as answered: the player's view, and for a live one the database's clock at the read. */
export interface Served {
  readonly view: SeriesView;
  /** The database's clock (ms since the epoch), for the `X-Now` header; null by turns. */
  readonly now: number | null;
}

const served = (series: LoadedSeries, side: Side): Served => ({
  view: viewOf(series, side),
  now: series.live?.now ?? null,
});

/** A player's view of a loaded series; a 404 for anyone not playing in it. */
function viewFor(series: LoadedSeries | undefined, userId: string): Served {
  const side = series === undefined ? undefined : sideOf(series.players, userId);
  if (series === undefined || side === undefined) {
    throw new ApiError(404, 'not_found', 'No such series');
  }
  return served(series, side);
}

/**
 * A series, after settling what ran out (settled on read, ADR 0052): a turn by turns forfeits; a
 * live series' clock is settled (live-service.ts). `loaded` is the series read alongside the
 * session; it is read again only after something was settled.
 */
export async function readSeries(
  deps: Deps,
  id: string,
  userId: string,
  loaded?: LoadedSeries,
): Promise<Served> {
  const series = loaded ?? (await loadSeries(deps.sql, id, userId));
  if (series !== undefined && sideOf(series.players, userId) !== undefined && series.live) {
    return viewFor(await settleLive(deps, series), userId);
  }
  const served =
    series?.expired !== true
      ? viewFor(series, userId)
      : (await settleExpired(deps.sql, id), viewFor(await loadSeries(deps.sql, id), userId));
  // Its player sees how a series by turns ended: Friends stops listing it (ADR 0086, no poke).
  if (served.view.status !== 'open' && served.view.live == null) {
    await markSeen(deps.sql, id, userId);
  }
  return served;
}

/**
 * Locks a pick (ADR 0052, "A turn on the server"). The first lock of a round and side wins: a
 * retry, a double tap or a second tab gets the series as stored, never a second pick. A pick that
 * isn't due (another round, the opponent's turn, a finished series) is refused, unless it is the
 * very pick already stored; in a live series so is one before its pick phase opens (a fight is
 * still on). `loaded` is a first read made alongside the session.
 */
export async function lockPick(
  deps: Deps,
  id: string,
  userId: string,
  request: PickRequest,
  loaded?: LoadedSeries,
): Promise<Served> {
  let series = loaded ?? (await loadSeries(deps.sql, id, userId));
  for (let tries = 0; tries < MOST_TRIES; tries += 1) {
    const side = series === undefined ? undefined : sideOf(series.players, userId);
    if (series === undefined || side === undefined) {
      throw new ApiError(404, 'not_found', 'No such series');
    }
    if (series.expired) {
      await settleExpired(deps.sql, id);
      series = await loadSeries(deps.sql, id);
      continue;
    }
    if (series.live !== null) series = await settleLive(deps, series);
    if (series.picks.some((p) => p.round === request.round && p.side === side)) {
      return served(series, side);
    }
    const clock = series.live;
    if (
      clock !== null &&
      series.status === 'open' &&
      (clock.opensAt === null || clock.now < clock.opensAt)
    ) {
      throw new ApiError(409, 'too_early', 'The fight is still on: pick when it ends');
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
    const moment = clock === null ? undefined : { lockedAt: clock.now };
    const move = await moveOf(deps.config, series, [pick], due.sides.length === 2, moment);
    const written = await writeSeries(deps.sql, id, series.version, move);
    if (written !== undefined) return served(after(series, move, written), side);
    // Another move came first: read the series as it is now and decide again.
    series = await loadSeries(deps.sql, id);
  }
  throw new ApiError(409, 'conflict', 'The series is busy: try again');
}

/**
 * "Leave and forfeit" (ADR 0053): the player leaves their live series and loses it at once. A
 * series already over (a forfeit settled first, the last round played) is answered as it is.
 */
export async function leaveSeries(deps: Deps, id: string, userId: string): Promise<Served> {
  for (let tries = 0; tries < MOST_TRIES; tries += 1) {
    const loaded = await loadSeries(deps.sql, id);
    const side = loaded === undefined ? undefined : sideOf(loaded.players, userId);
    if (loaded === undefined || side === undefined) {
      throw new ApiError(404, 'not_found', 'No such series');
    }
    if (loaded.live === null) {
      throw new ApiError(409, 'not_your_turn', 'Only a live match can be left');
    }
    const series = await settleLive(deps, loaded);
    if (series.status !== 'open') return served(series, side);
    const winner = side === 'a' ? 'b' : 'a';
    if (await forfeitSeries(deps.sql, id, series.version, winner, 'left')) {
      const after = await loadSeries(deps.sql, id);
      if (after !== undefined) return served(after, side);
    }
  }
  throw new ApiError(409, 'conflict', 'The series is busy: try again');
}
