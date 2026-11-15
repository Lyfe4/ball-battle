// Friend challenges on the server (ADR 0052, "Friend challenges"). The token in a link is an HMAC
// of the challenger and their request id under the server key: 128 bits nobody can guess, and the
// same link again for a retried create, though only the token's hash is stored. Accepting locks
// the challenge row, so a link starts one series however many friends open it at once.
// A live link (ADR 0053) is open while its sender waits in the lobby (each of their reads of it is
// a heartbeat), and a player is in one live match or lobby at a time.
import type { Accepted, ChallengeInfo, ChallengeLink, CreateChallenge } from '../api/challenges.ts';
import { LIVE_FORMATS } from '../api/live.ts';
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import {
  challengeByHash,
  insertChallenge,
  lockPlayer,
  markAccepted,
  openChallengesOf,
  openSeriesOf,
} from './db/challenges.ts';
import { cancelLobby, liveNowOf, lobbySeen } from './db/live.ts';
import { ApiError, type Deps } from './http.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { createSeries } from './series-service.ts';

/** How many series by turns a player may have open at once (ADR 0052 section 11, decided). */
export const MOST_OPEN_SERIES = 3;
/** How many unanswered links a player may have out at once. */
export const MOST_OPEN_CHALLENGES = 5;

export async function tokenFor(
  config: Config,
  creator: string,
  requestId: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    config.currentSeedKey.raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  // Its own domain: never the message of a seed (seeds.ts) or an IP (rate-limit.ts).
  const message = new TextEncoder().encode(`ballbattle/challenge/v1\0${creator}\0${requestId}`);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  return Buffer.from(mac.subarray(0, 16)).toString('base64url');
}

export const hashOf = async (token: string): Promise<Buffer> =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));

/** A lineup of `bestOf` different balls from the current ruleset's roster. */
async function checkLineup(lineup: readonly string[], bestOf: number): Promise<void> {
  const { ROSTER } = await rulesetSim(CURRENT_RULESET);
  const valid =
    lineup.length === bestOf &&
    new Set(lineup).size === bestOf &&
    lineup.every((ball) => ROSTER.includes(ball));
  if (!valid) {
    throw new ApiError(400, 'bad_request', `A lineup is ${String(bestOf)} different balls`);
  }
}

/** Refuses a player who already has a live match or a lobby waiting (one at a time). */
async function checkNotLive(db: TransactionSql, player: string): Promise<void> {
  await lockPlayer(db, player);
  const now = await liveNowOf(db, player);
  if (now !== undefined) {
    const where = now.kind === 'series' ? 'You are in a match already' : 'Your lobby is waiting';
    throw new ApiError(409, 'in_a_match', `${where}: finish it first`);
  }
}

export async function createChallenge(
  deps: Deps,
  creator: string,
  request: CreateChallenge,
): Promise<ChallengeLink> {
  await checkLineup(request.lineup, request.bestOf);
  if (request.live && !LIVE_FORMATS.includes(request.format)) {
    throw new ApiError(400, 'bad_request', 'Live matches are Reveal or Showdown');
  }
  const token = await tokenFor(deps.config, creator, request.requestId);
  return deps.sql.begin(async (db) => {
    const existing = await challengeByHash(db, await hashOf(token));
    if (existing === undefined) {
      if (request.live) await checkNotLive(db, creator);
      else if ((await openChallengesOf(db, creator)) >= MOST_OPEN_CHALLENGES) {
        throw new ApiError(409, 'too_many_series', 'You have enough links waiting already');
      }
      await insertChallenge(db, {
        tokenHash: await hashOf(token),
        creator,
        ruleset: CURRENT_RULESET,
        format: request.format,
        bestOf: request.bestOf,
        lineup: request.lineup,
        requestId: request.requestId,
        live: request.live,
      });
    }
    const made = existing ?? (await challengeByHash(db, await hashOf(token)));
    if (made === undefined) throw new Error('A challenge just made is missing');
    return {
      token,
      format: made.format,
      bestOf: made.bestOf,
      expiresAt: made.expiresAt.toISOString(),
    };
  });
}

/**
 * What a link's page shows. The sender's own read of their waiting live link is the lobby's
 * heartbeat: it stays open while they keep asking (ADR 0053).
 */
export async function challengeInfo(
  deps: Deps,
  token: string,
  viewer: string | undefined,
): Promise<ChallengeInfo> {
  let found = await challengeByHash(deps.sql, await hashOf(token));
  if (found === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
  const own = viewer !== undefined && viewer === found.creator;
  if (own && found.live && found.seriesId === null && !found.stopped) {
    await lobbySeen(deps.sql, found.id);
    // A friend may have accepted between the read and the heartbeat: the lobby moves on at once.
    found = (await challengeByHash(deps.sql, await hashOf(token))) ?? found;
  }
  const status: ChallengeInfo['status'] =
    found.seriesId !== null
      ? viewer !== undefined && viewer === found.acceptor
        ? 'accepted'
        : own
          ? 'yours'
          : 'taken'
      : found.stopped
        ? 'stopped'
        : own
          ? 'yours'
          : found.expired
            ? 'expired'
            : 'open';
  return {
    format: found.format,
    bestOf: found.bestOf,
    from: found.creatorName,
    status,
    seriesId: status === 'accepted' || status === 'yours' ? found.seriesId : null,
    live: found.live,
    own,
  };
}

/**
 * Accepts a link with the friend's lineup and starts the series, the challenger as side A. Once
 * only: a retry by the same friend gets the same series; anyone else is told it's taken.
 */
export async function acceptChallenge(
  deps: Deps,
  token: string,
  acceptor: string,
  lineup: readonly string[],
): Promise<Accepted> {
  const hash = await hashOf(token);
  return deps.sql.begin(async (db) => {
    // The acceptor first, then the link: one live match per player, on any host.
    await lockPlayer(db, acceptor);
    const found = await challengeByHash(db, hash, true);
    if (found === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
    if (found.seriesId !== null) {
      if (found.acceptor === acceptor) return { seriesId: found.seriesId };
      throw new ApiError(409, 'challenge_taken', 'Someone else has taken this challenge');
    }
    if (found.creator === acceptor) {
      throw new ApiError(409, 'own_challenge', 'This is your own link: send it to a friend');
    }
    if (found.stopped) {
      throw new ApiError(410, 'challenge_stopped', 'Your friend stopped waiting for this match');
    }
    if (found.expired) throw new ApiError(410, 'challenge_expired', 'This challenge has expired');
    await checkLineup(lineup, found.bestOf);
    if (found.live) await checkNotLive(db, acceptor);
    else if ((await openSeriesOf(db, acceptor)) >= MOST_OPEN_SERIES) {
      throw new ApiError(409, 'too_many_series', 'Finish one of your open series first');
    }
    const seriesId = await createSeries(db, deps.config, {
      format: found.format,
      bestOf: found.bestOf,
      players: { a: found.creator, b: acceptor },
      lineups: { a: found.lineup, b: lineup },
      live: found.live,
    });
    await markAccepted(db, found.id, seriesId);
    return { seriesId };
  });
}

/**
 * The sender cancels their live link from the lobby (ADR 0053): it stops, and a friend opening it
 * is told so. A link already accepted answers its series, so the lobby can go there instead.
 */
export async function cancelChallenge(
  deps: Deps,
  token: string,
  creator: string,
): Promise<ChallengeInfo> {
  const found = await challengeByHash(deps.sql, await hashOf(token));
  if (found?.creator !== creator) throw new ApiError(404, 'not_found', 'No such challenge');
  await cancelLobby(deps.sql, found.id, creator);
  return challengeInfo(deps, token, creator);
}
