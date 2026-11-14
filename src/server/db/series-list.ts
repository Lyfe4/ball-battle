// A player's series, as home lists them: open ones first (theirs to play first, soonest deadline
// first), then the 10 most recently finished.
import type { SeriesStatus, SeriesSummary, Turn } from '../../api/series.ts';
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Sql } from '../db.ts';

interface Raw {
  readonly id: string;
  readonly format: Format;
  readonly best_of: BestOf;
  readonly you: Side;
  readonly opponent: string | null;
  readonly status: SeriesStatus;
  readonly turn: Turn | null;
  readonly turn_deadline: Date | null;
  readonly winner: Side | null;
  readonly wins_a: number;
  readonly wins_b: number;
}

export async function listFor(sql: Sql, userId: string): Promise<SeriesSummary[]> {
  const rows = await sql<Raw[]>`
    with mine as (
      select s.*, case when s.player_a = ${userId} then 'a' else 'b' end as you
      from game.series s where s.player_a = ${userId} or s.player_b = ${userId}
    ), listed as (
      (select * from mine where status = 'open')
      union all
      (select * from mine where status <> 'open' order by finished_at desc limit 10)
    )
    select l.id, l.format, l.best_of, l.you, l.status, l.turn, l.turn_deadline, l.winner,
      p.display_name as opponent,
      (select count(*)::int from game.rounds r where r.series_id = l.id and r.winner = 'a') as wins_a,
      (select count(*)::int from game.rounds r where r.series_id = l.id and r.winner = 'b') as wins_b
    from listed l
    left join game.profiles p on p.user_id = case when l.you = 'a' then l.player_b else l.player_a end
    order by l.status = 'open' desc,
      (l.turn = l.you or l.turn = 'both') desc nulls last,
      l.turn_deadline asc nulls last, l.finished_at desc nulls last`;
  return rows.map((row) => ({
    id: row.id,
    format: row.format,
    bestOf: row.best_of,
    you: row.you,
    opponent: row.opponent,
    status: row.status,
    yourTurn: row.status === 'open' && (row.turn === row.you || row.turn === 'both'),
    deadline: row.turn_deadline?.toISOString() ?? null,
    winner: row.winner,
    score: { a: row.wins_a, b: row.wins_b },
  }));
}
