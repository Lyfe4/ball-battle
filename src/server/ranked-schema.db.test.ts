// Ranked play's tables (ADR 0083, PR 3): what the schema itself promises before any route uses it.
// A player's ranked rows go with their profile, a series keeps its season, at most one season is
// open, a rated series applies once per player, a season only on a ranked series, the board's
// partial index serves the board's query, and nobody shows on the board until hidden says so.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newPlayer, newSeries, type Player } from './test/series-support.ts';
import { adminSql, testDeps } from './test/support.ts';

const admin = adminSql();
const deps = testDeps();
/** Far from any season a test run makes elsewhere. */
const SEASON = 32_000;

beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  await admin`delete from game.seasons where id >= ${SEASON}`;
  await admin`
    insert into game.seasons (id, name, ruleset, starts_at, ends_at, closed_at)
    values (${SEASON}, 'Test season', 23, now() - interval '1 day', now() + interval '55 days',
      now())`;
});
afterAll(async () => {
  await admin`delete from game.rating_changes where season_id >= ${SEASON}`;
  await admin`delete from game.ratings where season_id >= ${SEASON}`;
  await admin`delete from game.season_rewards where season_id >= ${SEASON}`;
  await admin`delete from game.queue_entries where season_id >= ${SEASON}`;
  await admin`update game.series set season_id = null where season_id >= ${SEASON}`;
  await admin`delete from game.seasons where id >= ${SEASON}`;
  await admin.end();
  await deps.sql.end();
});

/** A ranked series between two new players, in the test season. */
async function rankedSeries(): Promise<{ id: string; a: Player; b: Player }> {
  const [a, b] = [await newPlayer(deps), await newPlayer(deps)];
  const id = await newSeries(deps, { a, b }, 'reveal');
  await admin`update game.series set kind = 'ranked', season_id = ${SEASON} where id = ${id}`;
  return { id, a, b };
}

const rated = (player: Player, trophies = 0, count = 0) => deps.sql`
  insert into game.ratings (user_id, season_id, trophies, peak_trophies, series_count)
  values (${player.userId}, ${SEASON}, ${trophies}, ${trophies}, ${count})`;

describe('the ranked tables', () => {
  it('start a rating as Glicko-2 starts one, its skill derived', async () => {
    const player = await newPlayer(deps);
    await rated(player);
    const [row] = await admin<{ rating: number; rd: number; volatility: number; skill: number }[]>`
      select rating, rd, volatility, skill from game.ratings where user_id = ${player.userId}`;
    expect(row).toStrictEqual({ rating: 1500, rd: 350, volatility: 0.06, skill: 800 });
    await admin`update game.ratings set rating = 1700, rd = 70 where user_id = ${player.userId}`;
    const [after] = await admin<{ skill: number }[]>`
      select skill from game.ratings where user_id = ${player.userId}`;
    expect(after?.skill).toBe(1560);
  });

  it('apply a rated series once per player', async () => {
    const { id, a } = await rankedSeries();
    const change = () => deps.sql`
      insert into game.rating_changes (series_id, user_id, season_id, result, rating_before,
        rd_before, rating_after, rd_after, trophies_before, trophies_after)
      values (${id}, ${a.userId}, ${SEASON}, 'win', 1500, 350, 1675, 250, 0, 60)`;
    await change();
    await expect(change()).rejects.toThrow(/rating_changes_pkey/);
  });

  it('go with the player, while the series keeps its season', async () => {
    const { id, a } = await rankedSeries();
    await rated(a, 60, 1);
    await deps.sql`
      insert into game.season_rewards (user_id, season_id, league) values (${a.userId}, ${SEASON}, 0)`;
    await deps.sql`
      insert into game.queue_entries (user_id, season_id, ruleset, lineup, skill)
      values (${a.userId}, ${SEASON}, 23, ${['archer', 'thorns', 'vampire', 'storm', 'venom']}, 800)`;
    await admin`delete from game.profiles where user_id = ${a.userId}`;
    const [left] = await admin<{ n: number }[]>`
      select (select count(*) from game.ratings where user_id = ${a.userId})
        + (select count(*) from game.season_rewards where user_id = ${a.userId})
        + (select count(*) from game.queue_entries where user_id = ${a.userId})::int as n`;
    expect(Number(left?.n)).toBe(0);
    const [series] = await admin<{ season_id: number }[]>`
      select season_id from game.series where id = ${id}`;
    expect(series?.season_id).toBe(SEASON);
  });

  it('hold one queue entry a player: a second tab or a double tap is one', async () => {
    const player = await newPlayer(deps);
    const join = () => deps.sql`
      insert into game.queue_entries (user_id, season_id, ruleset, lineup, skill)
      values (${player.userId}, ${SEASON}, 23, ${['archer', 'thorns', 'vampire', 'storm', 'venom']},
        800)
      on conflict (user_id) do nothing`;
    await join();
    await join();
    const rows = await admin`select 1 from game.queue_entries where user_id = ${player.userId}`;
    expect(rows.length).toBe(1);
    await deps.sql`delete from game.queue_entries where user_id = ${player.userId}`;
  });

  it('keep a season to ranked series, and at most one season open', async () => {
    const [a, b] = [await newPlayer(deps), await newPlayer(deps)];
    const friendly = await newSeries(deps, { a, b }, 'reveal');
    await expect(
      admin`update game.series set season_id = ${SEASON} where id = ${friendly}`,
    ).rejects.toThrow(/series_season_ranked/);
    const open = (id: number) => admin`
      insert into game.seasons (id, name, ruleset, starts_at, ends_at)
      values (${id}, 'Open', 23, now(), now() + interval '56 days')`;
    const already = await admin`select 1 from game.seasons where closed_at is null`;
    if (already.length === 0) await open(SEASON + 1);
    await expect(open(SEASON + 2)).rejects.toThrow(/seasons_one_open/);
  });

  it('serve the Everyone board from its partial index, and show everyone until they hide', async () => {
    const player = await newPlayer(deps);
    await rated(player, 900, 12);
    const plan = await admin.begin(async (sql) => {
      await sql`set local enable_seqscan = off`;
      return sql<{ 'QUERY PLAN': string }[]>`
        explain select user_id from game.ratings
        where season_id = ${SEASON} and series_count >= 10
        order by trophies desc, skill desc limit 100`;
    });
    expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain('ratings_board');
    const [profile] = await admin<{ board_hidden: boolean }[]>`
      select board_hidden from game.profiles where user_id = ${player.userId}`;
    expect(profile?.board_hidden).toBe(false);
  });
});
