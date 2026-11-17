// Live series (ADR 0053) for the database tests: made through the real routes or the service, and
// moved through time by shifting every stored time back (the database's `now()` can't be moved, so
// the series' past is moved instead). Times compared here are the database's.
import type { Accepted, ChallengeLink } from '../../api/challenges.ts';
import { TOSS_LEAD_MS } from '../../api/live.ts';
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Sql } from '../db.ts';
import type { Deps } from '../http.ts';
import { challengeOne, challenges } from '../routes/challenges.ts';
import { createSeries } from '../series-service.ts';
import type { Answer } from './client.ts';
import { LINEUP_3, LINEUP_5, newPlayer, read, type Player } from './series-support.ts';

/** Two new players in a new live series, the friend (B) arrived; A has not asked yet. */
export async function newLive(
  deps: Deps,
  format: Format = 'reveal',
  bestOf: BestOf = 3,
): Promise<{ id: string; players: Record<Side, Player> }> {
  const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
  const id = await deps.sql.begin((db) =>
    createSeries(db, deps.config, {
      format,
      bestOf,
      players: { a: players.a.userId, b: players.b.userId },
      lineups: bestOf === 3 ? LINEUP_3 : LINEUP_5,
      live: true,
    }),
  );
  return { id, players };
}

/**
 * A live series that has started: both players have read it once, and Reveal's coin toss is over
 * (ADR 0061), so its first pick is open.
 */
export async function startedLive(
  deps: Deps,
  admin: Sql,
  format: Format = 'reveal',
  bestOf: BestOf = 3,
) {
  const made = await newLive(deps, format, bestOf);
  await read(made.players.a, made.id);
  if (format === 'reveal') await travel(admin, made.id, TOSS_LEAD_MS);
  return made;
}

/**
 * Moves the series' times `ms` into the past, as if that much time went by while both pages kept
 * asking (presence stays fresh: `silence` makes a player quiet).
 */
export async function travel(admin: Sql, id: string, ms: number): Promise<void> {
  const by = `${String(ms)} milliseconds`;
  await admin`
    update game.series set created_at = created_at - ${by}::interval,
      started_at = started_at - ${by}::interval, turn_opens_at = turn_opens_at - ${by}::interval,
      turn_deadline = turn_deadline - ${by}::interval
    where id = ${id}`;
  await admin`
    update game.rounds set fight_at = fight_at - ${by}::interval, ends_at = ends_at - ${by}::interval
    where series_id = ${id}`;
  await admin`update game.picks set created_at = created_at - ${by}::interval where series_id = ${id}`;
}

/** `side` was last heard from `ms` ago (their page went quiet). */
export async function silence(admin: Sql, id: string, side: Side, ms: number): Promise<void> {
  await admin`
    update game.presence set seen_at = now() - ${`${String(ms)} milliseconds`}::interval
    where series_id = ${id} and side = ${side}`;
}

/** The series row's live columns, by the database's clock (ms since the epoch). */
export async function liveRow(admin: Sql, id: string) {
  const [row] = await admin<
    {
      status: string;
      winner: Side | null;
      end_reason: string | null;
      turn: string | null;
      started: number | null;
      opens: number | null;
      deadline: number | null;
      now: number;
    }[]
  >`
    select status, winner, end_reason, turn,
      (extract(epoch from started_at) * 1000)::float8 as started,
      (extract(epoch from turn_opens_at) * 1000)::float8 as opens,
      (extract(epoch from turn_deadline) * 1000)::float8 as deadline,
      (extract(epoch from now()) * 1000)::float8 as now
    from game.series where id = ${id}`;
  if (row === undefined) throw new Error('No such series');
  return row;
}

export const liveRounds = (admin: Sql, id: string) =>
  admin<{ round: number; fight: number; ends: number }[]>`
    select round, (extract(epoch from fight_at) * 1000)::float8 as fight,
      (extract(epoch from ends_at) * 1000)::float8 as ends
    from game.rounds where series_id = ${id} order by round`;

export const storedPicks = (admin: Sql, id: string) =>
  admin<{ round: number; side: Side; ball: string; auto: boolean; at: number }[]>`
    select round, side, ball, auto, (extract(epoch from created_at) * 1000)::float8 as at
    from game.picks where series_id = ${id} order by round, side`;

/** A live challenge sent by `from`. */
export function sendLive(
  from: Player,
  format: Format = 'reveal',
  requestId: string = crypto.randomUUID(),
): Promise<Answer> {
  return from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format,
    bestOf: 3,
    lineup: LINEUP_3.a,
    requestId,
    live: true,
  });
}

export const tokenOf = (answer: Answer): string => (answer.body as ChallengeLink).token;
export const seriesOf = (answer: Answer): string => (answer.body as Accepted).seriesId;

export const acceptLink = (by: Player, token: string): Promise<Answer> =>
  by.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {
    lineup: LINEUP_3.b,
  });

export const linkInfo = (by: Player, token: string): Promise<Answer> =>
  by.browser.call(challengeOne, 'GET', `/api/v1/challenges/${token}`);
