// Lineups picked together (ADR 0080): a start's read and its moves. Reading it is the player
// opening the lineup (kept as the first time, before the deadline only), and settles a clock that
// ran out. A move is the lineup so far or the lineup locked in; the second lock makes the series at
// once, the one who locked last marked as arrived. What a player sees of a start is their own draft
// and whether the other is ready, never the other's balls.
import { startLineupMs, type StartMove, type StartView } from '../api/start.ts';
import type { BestOf, Format, Side } from '../sim/index.ts';
import { checkLineup } from './challenges.ts';
import type { TransactionSql } from './db.ts';
import { insertStart, markOpened, startRow, writeDraft, type StartRow } from './db/starts.ts';
import { ApiError, type Deps } from './http.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { makeSeries, settleStart, startDue } from './start-settle.ts';
import { other, sideOf } from './view.ts';

/** A new start between two players who agreed to play live; returns its id. */
export function openStart(
  db: TransactionSql,
  input: {
    readonly players: Readonly<Record<Side, string>>;
    readonly format: Format;
    readonly bestOf: BestOf;
    readonly rematchOf?: string;
  },
): Promise<string> {
  return insertStart(db, { ...input, lineupMs: startLineupMs(input.bestOf) });
}

export function viewOfStart(row: StartRow, side: Side): StartView {
  const made = row.seriesId !== null;
  const sides: readonly Side[] = ['a', 'b'];
  return {
    id: row.id,
    you: side,
    format: row.format,
    bestOf: row.bestOf,
    they: row.names[other(side)],
    deadline: row.deadline,
    now: row.now,
    draft: row.drafts[side],
    seq: row.seqs[side],
    locked: row.locked[side],
    theirsLocked: row.locked[other(side)],
    seriesId: row.seriesId,
    filled: made ? sides.filter((one) => row.opened[one] && !row.locked[one]) : [],
    missed: made ? sides.filter((one) => !row.opened[one]) : [],
    rematchOf: row.rematchOf,
  };
}

/** The start as one of its players sees it, or a 404 for anyone else. */
function playerOf(row: StartRow | undefined, userId: string) {
  const side = row === undefined ? undefined : sideOf(row.players, userId);
  if (row === undefined || side === undefined) {
    throw new ApiError(404, 'not_found', 'No such start');
  }
  return { row, side };
}

/** A lineup so far: at most `bestOf` different balls of today's roster. */
async function checkDraft(lineup: readonly string[], bestOf: number): Promise<void> {
  const { ROSTER } = await rulesetSim(CURRENT_RULESET);
  const valid =
    lineup.length <= bestOf &&
    new Set(lineup).size === lineup.length &&
    lineup.every((ball) => ROSTER.includes(ball));
  if (!valid) {
    throw new ApiError(400, 'bad_request', `A lineup is up to ${String(bestOf)} different balls`);
  }
}

/** GET: opens the lineup for the reader, and makes the series if the clock has run out. */
export async function readStart(deps: Deps, id: string, userId: string): Promise<StartView> {
  const { side } = playerOf(await startRow(deps.sql, id), userId);
  if (!(await settleStart(deps.sql, deps.config, id))) {
    await markOpened(deps.sql, id, side);
  }
  return viewOfStart(playerOf(await startRow(deps.sql, id), userId).row, side);
}

/**
 * POST: the lineup so far, or locked in. Past the deadline the clock decides first, and the answer
 * says what it made. Retries and double taps change nothing more.
 */
export async function moveStart(
  deps: Deps,
  id: string,
  userId: string,
  move: StartMove,
): Promise<StartView> {
  return deps.sql.begin(async (db) => {
    const { row: before, side } = playerOf(await startRow(db, id, true), userId);
    if (before.seriesId === null && before.now >= before.deadline) {
      await makeSeries(db, deps.config, before);
    } else if (before.seriesId === null && !before.locked[side]) {
      if (move.lock) await checkLineup(move.lineup, before.bestOf);
      else await checkDraft(move.lineup, before.bestOf);
      await writeDraft(db, id, side, move);
      const after = playerOf(await startRow(db, id), userId).row;
      if (startDue(after)) await makeSeries(db, deps.config, after, side);
    }
    return viewOfStart(playerOf(await startRow(db, id), userId).row, side);
  });
}
