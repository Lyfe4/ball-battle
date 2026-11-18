// Rate limits (ADR 0052, "Abuse"): fixed windows counted in Postgres, by database time, so every
// function instance on every host shares one count. Limits are per account; only guest creation,
// which has no account yet, is per network (an IPv4 address, an IPv6 /64: network.ts), and the IP
// is never stored: its subject is an HMAC of the network under a server key, purged with its
// window. Netlify's own per-IP rule is only a flood guard.
import type { Config } from './config.ts';
import type { Sql, TransactionSql } from './db.ts';
import { ApiError } from './http.ts';
import { networkOf } from './network.ts';

export interface Limit {
  /** The name of what is counted. */
  readonly bucket: string;
  readonly max: number;
  readonly windowSeconds: number;
  /** What a refused player reads, given the seconds until the window ends. */
  readonly refusal?: (retrySeconds: number) => string;
}

/** "12 min", "3 h": how long until a window ends, rounded up. */
export function waitWords(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes < 60 ? `${String(minutes)} min` : `${String(Math.ceil(minutes / 60))} h`;
}

/**
 * Guest creation's refusal: it is the network's count, so it never says "too many tries" to a
 * player who tapped once, and it says how long.
 */
const networkFull = (retrySeconds: number) =>
  `Lots of new players on this network just now: try again in ${waitWords(retrySeconds)}`;

/** What each counted action may do. Generous: a class of players on one network must fit. */
export const LIMITS = {
  /**
   * Guests made on one network in an hour (ADR 0052 addendum, 2026-11-18): room for a school's
   * classes on one address, each player with a spare (an app's browser, then Safari).
   */
  guests: { bucket: 'guest.create', max: 150, windowSeconds: 3600, refusal: networkFull },
  /** And in a day (UTC): a school day, while a script on one network makes a third of before. */
  guestsDaily: {
    bucket: 'guest.create.day',
    max: 500,
    windowSeconds: 86_400,
    refusal: networkFull,
  },
  /** Challenges sent by one player. */
  challenges: { bucket: 'challenge.create', max: 20, windowSeconds: 3600 },
  /** Picks and acceptances by one player. */
  moves: { bucket: 'move', max: 120, windowSeconds: 600 },
  /**
   * Reads by one player: a live match's page asks about once a second, a lobby every 2 s, home
   * once. Three a second on average over 5 minutes leaves room for a few tabs, not for a loop.
   */
  reads: { bucket: 'read', max: 900, windowSeconds: 300 },
} as const satisfies Record<string, Limit>;

/**
 * Counts one action of `subject` and refuses it (429, with Retry-After) once the window holds more
 * than the limit allows. Refused attempts count too, so hammering doesn't open the window sooner.
 */
export async function spend(
  sql: Sql | TransactionSql,
  subject: string,
  limit: Limit,
): Promise<void> {
  const window = `${String(limit.windowSeconds)} seconds`;
  const [row] = await sql<{ readonly count: number; readonly retry: number }[]>`
    insert into game.rate_limits (subject, bucket, window_start, count)
    values (
      ${subject}, ${limit.bucket},
      date_bin(${window}::interval, now(), timestamptz '2000-01-01'), 1
    )
    on conflict (subject, bucket, window_start)
      do update set count = game.rate_limits.count + 1
    returning count,
      ceil(extract(epoch from (window_start + ${window}::interval - now())))::integer as retry`;
  if (row !== undefined) refuseOver(limit, row);
}

/** Refuses (429, with Retry-After) once a window's count is past the limit. */
export function refuseOver(
  limit: Limit,
  spent: { readonly count: number; readonly retry: number },
): void {
  if (spent.count > limit.max) {
    const retry = Math.max(1, spent.retry);
    const message = limit.refusal?.(retry) ?? 'Too many tries: wait a little';
    throw new ApiError(429, 'rate_limited', message, { 'Retry-After': String(retry) });
  }
}

/**
 * A client IP's network (network.ts) as a rate-limit subject: an HMAC under the server's seed key,
 * never the IP itself.
 */
export async function ipSubject(config: Config, ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    config.currentSeedKey.raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  // Its own domain, so this can never equal a seed's message (seeds.ts uses ballbattle/seed/v1).
  const message = new TextEncoder().encode(`ballbattle/ip/v1\0${networkOf(ip)}`);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  return `ip:${Buffer.from(mac.subarray(0, 16)).toString('hex')}`;
}

/** Drops windows that have ended (the scheduled sweep). */
export async function purgeRateLimits(sql: Sql): Promise<number> {
  const rows = await sql`
    delete from game.rate_limits where window_start < now() - interval '1 day' returning 1`;
  return rows.length;
}
