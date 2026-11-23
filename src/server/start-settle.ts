// Making a start's series (ADR 0080): once both lineups are locked in, or when the clock has run
// out. Only here are a live challenge's or a rematch's seeds made (createSeries, ADR 0051): neither
// player has seen the other's lineup, and nothing about the seeds existed while they chose. A
// lineup still being built when time ran out is finished at random from the balls it lacks (as a
// pick running out is, ADR 0053); a side that never opened the lineup is filled too, so the series
// exists, and loses at once by `start_missed` (nobody wins when neither opened it).
import type { Side } from '../sim/index.ts';
import type { Config } from './config.ts';
import type { Sql, TransactionSql } from './db.ts';
import { markPresent } from './db/live.ts';
import { loadSeries } from './db/series-record.ts';
import { forfeitSeries } from './db/series-write.ts';
import { markMade, startRow, startsToSettle, type StartRow } from './db/starts.ts';
import type { Deps } from './http.ts';
import { randomBall, secureRandom } from './live.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { createSeries } from './series-service.ts';

const SIDES: readonly Side[] = ['a', 'b'];

/** `draft` finished to `bestOf` balls at random from the rest of the roster. */
export function finishedAtRandom(
  draft: readonly string[],
  roster: readonly string[],
  bestOf: number,
  random: () => number = secureRandom,
): string[] {
  const lineup = [...draft];
  while (lineup.length < bestOf) {
    const ball = randomBall(
      roster.filter((one) => !lineup.includes(one)),
      random(),
    );
    if (ball === undefined) break;
    lineup.push(ball);
  }
  return lineup;
}

/** Whether `row`'s series is due: not made yet, and both locked in or out of time. */
export const startDue = (row: StartRow): boolean =>
  row.seriesId === null && ((row.locked.a && row.locked.b) || row.now >= row.deadline);

/**
 * Makes `row`'s series, the row locked by the caller and due (`startDue`). `here` is a side known
 * to be on the lineup now (the one who locked in last), marked as arrived. Returns the series id.
 */
export async function makeSeries(
  db: TransactionSql,
  config: Config,
  row: StartRow,
  here?: Side,
): Promise<string> {
  const { ROSTER } = await rulesetSim(CURRENT_RULESET);
  const lineups = {
    a: row.locked.a ? row.drafts.a : finishedAtRandom(row.drafts.a, ROSTER, row.bestOf),
    b: row.locked.b ? row.drafts.b : finishedAtRandom(row.drafts.b, ROSTER, row.bestOf),
  };
  const id = await createSeries(db, config, {
    format: row.format,
    bestOf: row.bestOf,
    players: row.players,
    lineups,
    live: true,
  });
  await markMade(db, row.id, id, lineups);
  // The link that opened this start reads its series too.
  await db`update game.challenges set series_id = ${id} where start_id = ${row.id}
    and series_id is null`;
  const missed = SIDES.filter((side) => !row.opened[side]);
  if (missed.length > 0) {
    const series = await loadSeries(db, id);
    const winner = missed.length === 1 ? (SIDES.find((side) => row.opened[side]) ?? null) : null;
    if (series !== undefined) {
      await forfeitSeries(db, id, series.version, winner, 'start_missed');
    }
  } else if (here !== undefined) {
    await markPresent(db, id, here);
  }
  return id;
}

/** Start `id` made into its series, inside `db`'s transaction, if it is due. True when made. */
export async function settleStartIn(
  db: TransactionSql,
  config: Config,
  id: string,
): Promise<boolean> {
  const row = await startRow(db, id, true);
  if (row === undefined || !startDue(row)) return false;
  await makeSeries(db, config, row);
  return true;
}

/**
 * Start `id` made into its series if its clock has run out (on any read and the sweep). Locks the
 * row only when it may be due. True when this call made it.
 */
export async function settleStart(sql: Sql, config: Config, id: string): Promise<boolean> {
  const seen = await startRow(sql, id);
  if (seen === undefined || !startDue(seen)) return false;
  return sql.begin((db) => settleStartIn(db, config, id));
}

/** The sweep: every start whose clock ran out with nobody reading it, made into its series. */
export async function settleStarts(deps: Deps): Promise<number> {
  let made = 0;
  for (const id of await startsToSettle(deps.sql)) {
    if (await settleStart(deps.sql, deps.config, id)) made += 1;
  }
  return made;
}
