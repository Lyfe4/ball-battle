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
  markStarted,
  openChallengesOf,
  openSeriesOf,
} from './db/challenges.ts';
import { cancelLobby, liveNowOf, lobbySeen } from './db/live.ts';
import { inviteeOf } from './friend-challenge.ts';
import { ApiError, type Deps } from './http.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { createSeries } from './series-service.ts';
import { openStart } from './start.ts';
import { settleStartIn } from './start-settle.ts';

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
export async function checkLineup(lineup: readonly string[], bestOf: number): Promise<void> {
  const { ROSTER } = await rulesetSim(CURRENT_RULESET);
  const valid =
    lineup.length === bestOf &&
    new Set(lineup).size === bestOf &&
    lineup.every((ball) => ROSTER.includes(ball));
  if (!valid) {
    throw new ApiError(400, 'bad_request', `A lineup is ${String(bestOf)} different balls`);
  }
}

/**
 * Refuses a player who already has a live match, a lobby waiting or a lineup being picked (one at a
 * time). A lineup whose clock ran out is made into its series first: it may have just ended.
 */
export async function checkNotLive(
  db: TransactionSql,
  config: Config,
  player: string,
): Promise<void> {
  await lockPlayer(db, player);
  let now = await liveNowOf(db, player);
  if (now?.kind === 'start' && (await settleStartIn(db, config, now.id))) {
    now = await liveNowOf(db, player);
  }
  if (now !== undefined) {
    const where =
      now.kind === 'series'
        ? 'You are in a match already'
        : now.kind === 'start'
          ? 'You are choosing a lineup already'
          : 'Your lobby is waiting';
    throw new ApiError(409, 'in_a_match', `${where}: finish it first`);
  }
}

export async function createChallenge(
  deps: Deps,
  creator: string,
  request: CreateChallenge,
  account = false,
): Promise<ChallengeLink> {
  // A live challenge is sent without a lineup: both pick together once it's accepted (ADR 0080).
  // By turns, the lineup comes with it.
  if (request.live && request.lineup !== undefined) {
    throw new ApiError(400, 'bad_request', 'A live challenge is sent without a lineup');
  }
  if (request.lineup !== undefined) await checkLineup(request.lineup, request.bestOf);
  else if (!request.live) throw new ApiError(400, 'bad_request', 'Send your lineup');
  if (request.live && !LIVE_FORMATS.includes(request.format)) {
    throw new ApiError(400, 'bad_request', 'Live matches are Reveal or Showdown');
  }
  if (request.friend !== undefined && !request.live) {
    throw new ApiError(400, 'bad_request', 'A challenge to a friend is live');
  }
  const friend = request.friend;
  const token = await tokenFor(deps.config, creator, request.requestId);
  return deps.sql.begin(async (db) => {
    const existing = await challengeByHash(db, await hashOf(token));
    if (existing === undefined) {
      // A challenge to a friend (ADR 0079 PR (d)): only an accepted friend of an account.
      const invitee =
        friend === undefined
          ? undefined
          : await inviteeOf(db, deps.config, { userId: creator, account }, friend);
      if (request.live) await checkNotLive(db, deps.config, creator);
      else if ((await openChallengesOf(db, creator)) >= MOST_OPEN_CHALLENGES) {
        throw new ApiError(409, 'too_many_series', 'You have enough links waiting already');
      }
      await insertChallenge(db, {
        tokenHash: await hashOf(token),
        creator,
        ruleset: CURRENT_RULESET,
        format: request.format,
        bestOf: request.bestOf,
        lineup: request.lineup ?? null,
        requestId: request.requestId,
        live: request.live,
        ...(invitee === undefined ? {} : { invitee }),
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
  if (own && found.live && !found.accepted && !found.stopped) {
    await lobbySeen(deps.sql, found.id);
    // A friend may have accepted between the read and the heartbeat: the lobby moves on at once.
    found = (await challengeByHash(deps.sql, await hashOf(token))) ?? found;
  }
  const status: ChallengeInfo['status'] = found.accepted
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
  const mine = status === 'accepted' || status === 'yours';
  return {
    format: found.format,
    bestOf: found.bestOf,
    from: found.creatorName,
    status,
    seriesId: mine ? found.seriesId : null,
    startId: mine ? found.startId : null,
    live: found.live,
    own,
    // Who it was sent to is the sender's alone to see.
    invitee: own ? found.inviteeName : null,
    declined: own && found.declined,
  };
}

/**
 * Accepts a link, the challenger as side A. A live link starts the lineups (ADR 0080): both pick at
 * once, and the series is made when both are in. Once only: a retry by the same friend gets the
 * same start (or series); anyone else is told it's taken.
 *
 * `lineup` is a series by turns': with the challenger's lineup in hand too, the series starts at
 * once. A live link takes none.
 */
export async function acceptChallenge(
  deps: Deps,
  token: string,
  acceptor: string,
  lineup?: readonly string[],
): Promise<Accepted> {
  const hash = await hashOf(token);
  return deps.sql.begin(async (db) => {
    // The acceptor first, then the link: one live match per player, on any host.
    await lockPlayer(db, acceptor);
    const found = await challengeByHash(db, hash, true);
    if (found === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
    if (found.accepted) {
      if (found.acceptor === acceptor) {
        return { seriesId: found.seriesId, startId: found.startId };
      }
      throw new ApiError(409, 'challenge_taken', 'Someone else has taken this challenge');
    }
    if (found.creator === acceptor) {
      throw new ApiError(409, 'own_challenge', 'This is your own link: send it to a friend');
    }
    if (found.stopped) {
      throw new ApiError(410, 'challenge_stopped', 'Your friend stopped waiting for this match');
    }
    if (found.expired) throw new ApiError(410, 'challenge_expired', 'This challenge has expired');
    if (found.live) {
      if (lineup !== undefined) {
        throw new ApiError(400, 'bad_request', 'A live challenge is accepted without a lineup');
      }
      await checkNotLive(db, deps.config, acceptor);
      const startId = await openStart(db, {
        players: { a: found.creator, b: acceptor },
        format: found.format,
        bestOf: found.bestOf,
      });
      await markStarted(db, found.id, startId);
      return { seriesId: null, startId };
    }
    if (lineup === undefined) throw new ApiError(400, 'bad_request', 'Send {lineup}');
    await checkLineup(lineup, found.bestOf);
    if ((await openSeriesOf(db, acceptor)) >= MOST_OPEN_SERIES) {
      throw new ApiError(409, 'too_many_series', 'Finish one of your open series first');
    }
    // Sent with the sender's lineup: a link by turns always is (createChallenge).
    const theirs = found.lineup;
    if (theirs === null) throw new Error('A challenge by turns without its lineup');
    const seriesId = await createSeries(db, deps.config, {
      format: found.format,
      bestOf: found.bestOf,
      players: { a: found.creator, b: acceptor },
      lineups: { a: theirs, b: lineup },
      live: found.live,
    });
    await markAccepted(db, found.id, seriesId);
    return { seriesId, startId: null };
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
