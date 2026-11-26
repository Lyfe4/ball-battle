// The record's database tests (ADR 0088, 0089): finished series made by the service and ended in
// SQL with the columns the series service writes, and the record as its reader is answered.
import { expect } from 'vitest';
import type { RecordResponse } from '../../api/record.ts';
import type { Side } from '../../sim/index.ts';
import type { Sql } from '../db.ts';
import type { Deps } from '../http.ts';
import { meRecord } from '../routes/record.ts';
import { newSeries, type Player } from './series-support.ts';

export interface Ending {
  readonly status: 'finished' | 'forfeit' | 'void';
  /** Null: a forfeit both sides missed, or a void series. */
  readonly winner: Side | null;
  /** The rounds each side won. */
  readonly rounds?: { readonly a: number; readonly b: number };
  /** Minutes ago it finished, so a test can order them. */
  readonly ago?: number;
  readonly live?: boolean;
  /** Why a forfeit ended (game.series.end_reason); none for one played out. */
  readonly reason?: 'timeout' | 'left' | 'disconnected' | 'start_missed';
  readonly bestOf?: 3 | 5;
}

export function recordSupport(deps: Deps, admin: Sql) {
  const recordOf = async (player: Player): Promise<RecordResponse> => {
    const answer = await player.browser.call(meRecord, 'GET', '/api/v1/me/record');
    expect(answer.status, JSON.stringify(answer.body)).toBe(200);
    return answer.body as RecordResponse;
  };

  /** A Reveal series between `a` and `b`, ended as `ending` says. */
  async function played(
    a: Player,
    b: Player,
    ending: Ending,
    lineups?: readonly [string[], string[]],
  ): Promise<string> {
    const id = await newSeries(deps, { a, b }, 'reveal', ending.bestOf);
    const { a: wonA, b: wonB } = ending.rounds ?? { a: 0, b: 0 };
    const winners: Side[] = [...Array<Side>(wonA).fill('a'), ...Array<Side>(wonB).fill('b')];
    for (const [round, winner] of winners.entries()) {
      await admin`
        insert into game.rounds (series_id, round, a, b, seeds, outcomes, winner, sudden_death)
        values (${id}, ${round}, 'archer', 'brawler', ${[1]}, ${[winner]}, ${winner}, false)`;
    }
    await admin`
      update game.series set status = ${ending.status}, winner = ${ending.winner}, turn = null,
        turn_deadline = null, live = ${ending.live ?? false}, end_reason = ${ending.reason ?? null},
        finished_at = now() - make_interval(mins => ${ending.ago ?? 0}),
        lineup_a = coalesce(${lineups?.[0] ?? null}::text[], lineup_a),
        lineup_b = coalesce(${lineups?.[1] ?? null}::text[], lineup_b)
      where id = ${id}`;
    return id;
  }

  return { recordOf, played };
}
