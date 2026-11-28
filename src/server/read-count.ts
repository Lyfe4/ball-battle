// Reads counted one in ten, as ten (2026-11-29, the launch-eve report on writes): every counted
// read used to upsert its rate-limit row, about one write a second per player in a live match.
// Now one read in READ_SAMPLE writes, adding READ_SAMPLE, so a window's count is the same on
// average with a tenth of the writes. The others still read the window's count in the same
// statement, never a write, and are refused once it is over: a loop is stopped as soon as before,
// on every request, not one in ten.
//
// Honest players stay far from the line: 500 reads in 5 minutes (1.7 a second, more than a live
// match and a lobby together) counts 500 on average with a spread of about 67, so passing 900 is
// a six-sigma event. The randomness is the server's own (crypto), never the player's to choose.
import type { PendingQuery, Row } from 'postgres';
import type { Sql, TransactionSql } from './db.ts';
import type { Deps } from './http.ts';
import { LIMITS, refuseOver, type Limit } from './rate-limit.ts';

type Db = Sql | TransactionSql;

/** One read in this many writes, and adds this many. */
export const READ_SAMPLE = 10;

/** A read's weight in its window: READ_SAMPLE one time in READ_SAMPLE, else 0 (no write). */
export function sampledReadWeight(): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value % READ_SAMPLE === 0 ? READ_SAMPLE : 0;
}

/** How one read is counted: under which limit, and how much it adds (0: it only looks). */
export interface ReadCount {
  readonly limit: Limit;
  readonly weight: number;
}

/** This read's count under the reads limit, its weight drawn now (tests may fix it). */
export function readCountOf(deps: Deps): ReadCount {
  return { limit: LIMITS.reads, weight: (deps.readWeight ?? sampledReadWeight)() };
}

/**
 * The CTEs `counted` (the write, none at weight 0) and `spent` (the window's count after this
 * read, and the seconds until it ends), both only where `gate` holds; `spent` has no row without a
 * count. In one statement with whatever else the read does.
 */
export function countedAs(
  db: Db,
  subject: string | null,
  count: ReadCount | undefined,
  gate: () => PendingQuery<Row[]>,
) {
  const window = count === undefined ? null : `${String(count.limit.windowSeconds)} seconds`;
  const bucket = count?.limit.bucket ?? null;
  const weight = count?.weight ?? 0;
  const start = db`date_bin(${window}::interval, now(), timestamptz '2000-01-01')`;
  return db`
    counted as (
      insert into game.rate_limits (subject, bucket, window_start, count)
      select ${subject}::text, ${bucket}::text, ${start}, ${weight}::int
      where ${weight}::int > 0 and ${window}::text is not null and ${gate()}
      on conflict (subject, bucket, window_start)
        do update set count = game.rate_limits.count + excluded.count
      returning count
    ), spent as (
      select coalesce((select count from counted),
          (select r.count from game.rate_limits r
            where r.subject = ${subject}::text and r.bucket = ${bucket}::text
              and r.window_start = ${start}),
          0) as count,
        ceil(extract(epoch from (${start} + ${window}::interval - now())))::integer as retry
      where ${window}::text is not null and ${gate()}
    )`;
}

/** Counts one read of `subject` on its own (one round trip), refusing it once over the limit. */
export async function spendRead(deps: Deps, subject: string): Promise<void> {
  const count = readCountOf(deps);
  const [row] = await deps.sql<{ readonly count: number; readonly retry: number }[]>`
    with ${countedAs(deps.sql, subject, count, () => deps.sql`true`)}
    select count, retry from spent`;
  if (row !== undefined) refuseOver(count.limit, row);
}
