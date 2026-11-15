// The database connection (ADR 0052, section 9): plain SQL through `postgres` (porsager), as the
// `game_api` role. Through Supabase's pooler in transaction mode it needs `prepare: false`; one
// connection per function instance (`max: 1`), since an instance serves one request at a time.
// bigint columns (32-bit unsigned seeds) come back as numbers: every one fits exactly.
//
// Round trips: the functions may run far from the database (Netlify's Ohio to Sydney, ~200 ms
// each). Without prepared statements the driver sends a query and its values in one go only when
// it knows every value's type; a string has none, so it would first ask the server for the types:
// a second round trip for nearly every query. So every string goes as Postgres's `unknown` type
// (705), which the server reads exactly as an untyped literal (it still becomes a uuid, text or
// interval from its context), a boolean as `unknown` 'true' or 'false' (measured: a typed boolean
// waits too), and every array of strings as `text[]`. Numbers and nulls need nothing, as long as
// no custom type serializes values (the bigint type below only parses).
import postgres from 'postgres';

export type Sql = postgres.Sql;
/** A transaction's own `sql`, as `sql.begin` hands it. */
export type TransactionSql = postgres.TransactionSql;

const UNKNOWN = 705;
const TEXT_ARRAY = 1009;

/** A query's value as the driver can send without asking the server for its type first. */
function typed(sql: Sql | TransactionSql, value: unknown): unknown {
  if (typeof value === 'string') return sql.typed(value, UNKNOWN);
  // A boolean too: typed as such, the driver still waits on the server (measured).
  if (typeof value === 'boolean') return sql.typed(String(value), UNKNOWN);
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
    return sql.typed(value, TEXT_ARRAY);
  }
  return value;
}

const isTemplate = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && 'raw' in value;

/** `sql` with every tagged query's strings typed (above), its transactions' `sql` too. */
function quick<S extends Sql | TransactionSql>(sql: S): S {
  return new Proxy(sql, {
    apply(target, self, args: unknown[]) {
      const [strings, ...values] = args;
      if (!isTemplate(strings)) return Reflect.apply(target, self, args) as unknown;
      return Reflect.apply(target, self, [
        strings,
        ...values.map((v) => typed(target, v)),
      ]) as unknown;
    },
    get(target, key) {
      const value = Reflect.get(target, key) as unknown;
      if (key !== 'begin' || typeof value !== 'function') return value;
      // A transaction's own sql is typed the same way.
      return (...args: unknown[]) => {
        const last = args.at(-1);
        if (typeof last === 'function') {
          args[args.length - 1] = (tx: TransactionSql) =>
            (last as (tx: TransactionSql) => unknown)(quick(tx));
        }
        return Reflect.apply(value, target, args) as unknown;
      };
    },
  });
}

/** `onQuery` sees every query sent (tests count them); never its values. */
export function databaseFor(url: string, onQuery?: () => void): Sql {
  return quick(
    postgres(url, {
      ...(onQuery === undefined
        ? {}
        : {
            debug: () => {
              onQuery();
            },
          }),
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      // Our own log line covers each request; Postgres notices are not logged.
      onnotice: () => undefined,
      types: {
        // Parsed only: a type that serializes would take every query off the one-trip path.
        bigint: { from: [20], parse: (value: string) => Number(value) },
      },
    }),
  );
}
