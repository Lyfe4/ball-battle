// The database connection (ADR 0052, section 9): plain SQL through `postgres` (porsager), as the
// `game_api` role. Through Supabase's pooler in transaction mode it needs `prepare: false`; one
// connection per function instance (`max: 1`), since an instance serves one request at a time.
// bigint columns (32-bit unsigned seeds) come back as numbers: every one fits exactly.
import postgres from 'postgres';

export type Sql = postgres.Sql;
/** A transaction's own `sql`, as `sql.begin` hands it. */
export type TransactionSql = postgres.TransactionSql;

export function databaseFor(url: string): Sql {
  return postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // Our own log line covers each request; Postgres notices are not logged.
    onnotice: () => undefined,
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: number) => String(value),
        parse: (value: string) => Number(value),
      },
    },
  });
}
