// Rate limits (ADR 0052, "Abuse"): fixed windows counted in Postgres, by database time, so every
// function instance on every host shares one count. Limits are per account; only guest creation
// and the health check, which have no account, are per network (an IPv4 address, an IPv6 /64: network.ts), and the IP
// is never stored: its subject is an HMAC of the network under a server key, purged with its
// window. Netlify's own per-IP rule is only a flood guard.
import type { ErrorCode } from '../api/errors.ts';
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
  /** A calendar month (UTC) rather than `windowSeconds` (kept as its longest, for the purge). */
  readonly calendarMonth?: true;
  /** The answer when refused, if not 429 `rate_limited`: a cap on everyone (ADR 0079). */
  readonly answer?: { readonly status: number; readonly code: ErrorCode };
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

const addressFull = (retrySeconds: number) =>
  `We've sent a few codes to that address: try again in ${waitWords(retrySeconds)}`;
const networkCodes = (retrySeconds: number) =>
  `Lots of email sign-ins on this network today: continue with Google, or try again in ${waitWords(retrySeconds)}`;
/** Everyone's codes are used up (ADR 0079): the same words for every player and address. */
export const EMAIL_BUSY = 'Email codes are busy today: continue with Google, or try tomorrow';
const busy = { status: 503, code: 'email_busy' } as const;
const DAY = 86_400;

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
  /**
   * Health checks from one network in an hour, which needs no session: an uptime monitor every
   * 10 minutes asks 6 times, the friend switch's wait for a deploy about 40.
   */
  health: { bucket: 'health', max: 120, windowSeconds: 3600 },
  // Email codes (ADR 0079), counted before Auth is asked to send one. Each address and network is
  // an HMAC; the caps on everyone keep us under Resend Free's 100 a day and 3,000 a month.
  /** Codes sent to one address. */
  codesToAddress: { bucket: 'code.address', max: 3, windowSeconds: 3600, refusal: addressFull },
  codesToAddressDaily: {
    bucket: 'code.address.day',
    max: 5,
    windowSeconds: DAY,
    refusal: addressFull,
  },
  /** Codes asked for by one guest. */
  codesByGuest: { bucket: 'code.guest', max: 5, windowSeconds: 3600, refusal: addressFull },
  /** Codes sent from one network: a fifth of everyone's day, so one network can't empty it. */
  codesFromNetwork: { bucket: 'code.network', max: 10, windowSeconds: 3600, refusal: networkCodes },
  codesFromNetworkDaily: {
    bucket: 'code.network.day',
    max: 20,
    windowSeconds: DAY,
    refusal: networkCodes,
  },
  /** Everyone's codes in a day (UTC): Resend's 100 less a margin. */
  codesDaily: {
    bucket: 'code.all.day',
    max: 90,
    windowSeconds: DAY,
    refusal: () => EMAIL_BUSY,
    answer: busy,
  },
  /** And in a calendar month (UTC): Resend's 3,000 less a margin. */
  codesMonthly: {
    bucket: 'code.all.month',
    max: 2700,
    windowSeconds: 31 * DAY,
    calendarMonth: true,
    refusal: () => 'Email codes are busy this month: continue with Google, or try again next month',
    answer: busy,
  },
  /** Tries at one code: then it is dead, and a new one is needed. */
  triesAtCode: {
    bucket: 'code.tries',
    max: 5,
    windowSeconds: 600,
    refusal: () => 'That code has expired: send a new one',
    answer: { status: 400, code: 'wrong_code' },
  },
  /** Tries for one address, across its codes. */
  triesAtAddress: { bucket: 'code.tries.address', max: 10, windowSeconds: 3600 },
  /** Tries from one network. */
  triesFromNetwork: { bucket: 'code.tries.network', max: 50, windowSeconds: 600 },
  /** A Google sign-in's state, used once (ADR 0079): a copied cookie can't finish it again. */
  googleState: { bucket: 'google.state', max: 1, windowSeconds: 600 },
} as const satisfies Record<string, Limit>;

/** Everyone's subject, for the caps on all players at once. */
export const EVERYONE = 'all';

/**
 * Counts one action under each of `spends` in one statement (one round trip), then refuses at the
 * first, in order, that is over. Every one is counted, refused or not, as `spend` does.
 */
export async function spendAll(
  sql: Sql | TransactionSql,
  spends: readonly { readonly subject: string; readonly limit: Limit }[],
): Promise<void> {
  const rows = await sql<
    { readonly bucket: string; readonly count: number; readonly retry: number }[]
  >`
    with spends as (
      select subject, bucket, seconds::int as seconds, month::boolean as month
      from unnest(${spends.map((s) => s.subject)}::text[],
        ${spends.map((s) => s.limit.bucket)}::text[],
        ${spends.map((s) => String(s.limit.windowSeconds))}::text[],
        ${spends.map((s) => String(s.limit.calendarMonth === true))}::text[])
        as u(subject, bucket, seconds, month)
    ), windows as (
      select subject, bucket,
        case when month then date_trunc('month', now(), 'UTC')
          else date_bin(make_interval(secs => seconds), now(), timestamptz '2000-01-01')
        end as start,
        case when month then interval '1 month' else make_interval(secs => seconds) end as length
      from spends
    ), counted as (
      insert into game.rate_limits (subject, bucket, window_start, count)
      select subject, bucket, start, 1 from windows
      on conflict (subject, bucket, window_start)
        do update set count = game.rate_limits.count + 1
      returning subject, bucket, window_start, count
    )
    select c.bucket, c.count,
      ceil(extract(epoch from (c.window_start + w.length - now())))::integer as retry
    from counted c join windows w using (subject, bucket)`;
  for (const { limit } of spends) {
    const row = rows.find((candidate) => candidate.bucket === limit.bucket);
    if (row !== undefined) refuseOver(limit, row);
  }
}

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
    const { status, code } = limit.answer ?? { status: 429, code: 'rate_limited' };
    throw new ApiError(status, code, message, { 'Retry-After': String(retry) });
  }
}

/**
 * A client IP's network (network.ts) as a rate-limit subject: an HMAC under the server's seed key,
 * never the IP itself.
 */
export function ipSubject(config: Config, ip: string): Promise<string> {
  // Its own domain, so this can never equal a seed's message (seeds.ts uses ballbattle/seed/v1).
  return keyedSubject(config, 'ip', networkOf(ip));
}

/** An email address as a rate-limit subject (ADR 0079): an HMAC, never the address. */
export function emailSubject(config: Config, email: string): Promise<string> {
  return keyedSubject(config, 'email', email);
}

async function keyedSubject(config: Config, kind: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    config.currentSeedKey.raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = new TextEncoder().encode(`ballbattle/${kind}/v1 ${value}`);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  return `${kind}:${Buffer.from(mac.subarray(0, 16)).toString('hex')}`;
}

/**
 * Drops windows that have ended (the scheduled sweep, every 15 minutes), each by its own length:
 * an hour's count of a network goes within 15 minutes of that hour, as the privacy policy says. A
 * bucket no longer in LIMITS goes after a day.
 */
export async function purgeRateLimits(sql: Sql): Promise<number> {
  const limits = Object.values(LIMITS);
  const rows = await sql`
    delete from game.rate_limits r
    where r.window_start + coalesce(
      (select make_interval(secs => l.seconds)
        from unnest(${limits.map((limit) => limit.bucket)}::text[],
          ${limits.map((limit) => limit.windowSeconds)}::int[]) as l(bucket, seconds)
        where l.bucket = r.bucket),
      interval '1 day') <= now()
    returning 1`;
  return rows.length;
}
