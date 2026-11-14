// game.challenges: friend links (ADR 0052). Times are the database's: a link expires 7 days after
// it was made, by `now()`.
import type { BestOf, Format } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface ChallengeRow {
  readonly id: string;
  readonly creator: string;
  readonly creatorName: string | null;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly lineup: readonly string[];
  readonly expiresAt: Date;
  readonly expired: boolean;
  readonly seriesId: string | null;
  /** Who accepted it: side B of its series. */
  readonly acceptor: string | null;
}

interface Raw {
  readonly id: string;
  readonly creator: string;
  readonly creator_name: string | null;
  readonly format: Format;
  readonly best_of: BestOf;
  readonly lineup: string[];
  readonly expires_at: Date;
  readonly expired: boolean;
  readonly series_id: string | null;
  readonly acceptor: string | null;
}

export async function challengeByHash(
  db: Db,
  hash: Buffer,
  lock = false,
): Promise<ChallengeRow | undefined> {
  const forUpdate = lock ? db`for update of c` : db``;
  const [raw] = await db<Raw[]>`
    select c.id, c.creator, p.display_name as creator_name, c.format, c.best_of, c.lineup,
      c.expires_at, c.expires_at < now() as expired, c.series_id, s.player_b as acceptor
    from game.challenges c
    left join game.profiles p on p.user_id = c.creator
    left join game.series s on s.id = c.series_id
    where c.token_hash = ${hash}
    ${forUpdate}`;
  return raw === undefined
    ? undefined
    : {
        id: raw.id,
        creator: raw.creator,
        creatorName: raw.creator_name,
        format: raw.format,
        bestOf: raw.best_of,
        lineup: raw.lineup,
        expiresAt: raw.expires_at,
        expired: raw.expired,
        seriesId: raw.series_id,
        acceptor: raw.acceptor,
      };
}

export interface NewChallenge {
  readonly tokenHash: Buffer;
  readonly creator: string;
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly lineup: readonly string[];
  readonly requestId: string;
}

export async function insertChallenge(db: Db, challenge: NewChallenge): Promise<void> {
  await db`
    insert into game.challenges (token_hash, creator, ruleset, format, best_of, lineup,
      request_id, expires_at)
    values (${challenge.tokenHash}, ${challenge.creator}, ${challenge.ruleset}, ${challenge.format},
      ${challenge.bestOf}, ${[...challenge.lineup]}, ${challenge.requestId},
      now() + interval '7 days')
    on conflict (creator, request_id) do nothing`;
}

export async function markAccepted(db: Db, id: string, seriesId: string): Promise<void> {
  await db`update game.challenges set series_id = ${seriesId} where id = ${id} and series_id is null`;
}

/** Links a player has out that nobody has accepted yet and that haven't expired. */
export async function openChallengesOf(db: Db, creator: string): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count(*)::int as count from game.challenges
    where creator = ${creator} and series_id is null and expires_at > now()`;
  return row?.count ?? 0;
}

export async function openSeriesOf(db: Db, player: string): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count(*)::int as count from game.series
    where status = 'open' and (player_a = ${player} or player_b = ${player})`;
  return row?.count ?? 0;
}
