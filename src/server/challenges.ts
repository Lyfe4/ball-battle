// Friend challenges on the server (ADR 0052, "Friend challenges"). The token in a link is an HMAC
// of the challenger and their request id under the server key: 128 bits nobody can guess, and the
// same link again for a retried create, though only the token's hash is stored. Accepting locks
// the challenge row, so a link starts one series however many friends open it at once.
import type { Accepted, ChallengeInfo, ChallengeLink, CreateChallenge } from '../api/challenges.ts';
import type { Config } from './config.ts';
import {
  cancelOpen,
  challengeByHash,
  heartbeat,
  insertChallenge,
  markAccepted,
  openChallengesOf,
  openSeriesOf,
} from './db/challenges.ts';
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

export async function createChallenge(
  deps: Deps,
  creator: string,
  request: CreateChallenge,
): Promise<ChallengeLink> {
  await checkLineup(request.lineup, request.bestOf);
  const token = await tokenFor(deps.config, creator, request.requestId);
  return deps.sql.begin(async (db) => {
    const existing = await challengeByHash(db, await hashOf(token));
    if (existing === undefined) {
      if ((await openChallengesOf(db, creator)) >= MOST_OPEN_CHALLENGES) {
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

export async function challengeInfo(
  deps: Deps,
  token: string,
  viewer: string | undefined,
): Promise<ChallengeInfo> {
  // PROTOTYPE (live): the sender waiting in the lobby is present; a series that starts finds them so.
  if (viewer !== undefined) await heartbeat(deps.sql, viewer);
  const found = await challengeByHash(deps.sql, await hashOf(token));
  if (found === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
  const status: ChallengeInfo['status'] =
    viewer !== undefined && viewer === found.creator
      ? 'yours'
      : found.seriesId !== null
        ? viewer !== undefined && viewer === found.acceptor
          ? 'accepted'
          : 'taken'
        : found.expired
          ? 'expired'
          : 'open';
  return {
    format: found.format,
    bestOf: found.bestOf,
    from: found.creatorName,
    status,
    seriesId: status === 'accepted' || status === 'yours' ? found.seriesId : null,
  };
}

/** PROTOTYPE (live): the sender gives up waiting; a link nobody accepted yet expires now. */
export async function cancelChallenge(deps: Deps, token: string, creator: string): Promise<void> {
  await cancelOpen(deps.sql, await hashOf(token), creator);
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
    const found = await challengeByHash(db, hash, true);
    if (found === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
    if (found.seriesId !== null) {
      if (found.acceptor === acceptor) return { seriesId: found.seriesId };
      throw new ApiError(409, 'challenge_taken', 'Someone else has taken this challenge');
    }
    if (found.creator === acceptor) {
      throw new ApiError(409, 'own_challenge', 'This is your own link: send it to a friend');
    }
    if (found.expired) throw new ApiError(410, 'challenge_expired', 'This challenge has expired');
    await checkLineup(lineup, found.bestOf);
    if ((await openSeriesOf(db, acceptor)) >= MOST_OPEN_SERIES) {
      throw new ApiError(409, 'too_many_series', 'Finish one of your open series first');
    }
    const seriesId = await createSeries(db, deps.config, {
      format: found.format,
      bestOf: found.bestOf,
      players: { a: found.creator, b: acceptor },
      lineups: { a: found.lineup, b: lineup },
    });
    await markAccepted(db, found.id, seriesId);
    return { seriesId };
  });
}
