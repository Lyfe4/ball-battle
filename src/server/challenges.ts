// Friend challenges on the server (ADR 0052, "Friend challenges"). The token in a link is an HMAC
// of the challenger and their request id under the server key: 128 bits nobody can guess, and the
// same link again for a retried create, though only the token's hash is stored. Accepting locks
// the challenge row, so a link starts one series however many friends open it at once.
// A live link (ADR 0053) is open while its sender waits in the lobby (each of their reads of it is
// a heartbeat), and a player is in one live match or lobby at a time. A player has one outgoing
// challenge at a time (ADR 0089 addendum of 2026-11-27): sending one calls off the older one in
// the same transaction, and sending one to a friend whose own lobby waits for you is an accept.
import type { Accepted, ChallengeInfo, ChallengeLink, CreateChallenge } from '../api/challenges.ts';
import { LIVE_FORMATS } from '../api/live.ts';
import type { Config } from './config.ts';
import type { TransactionSql } from './db.ts';
import {
  blockedBy,
  challengeByHash,
  challengeById,
  insertChallenge,
  lobbyWaitingFor,
  lockPlayers,
  markAccepted,
  markStarted,
  openSeriesOf,
  startBetween,
  supersedeOutgoing,
  type ChallengeRow,
} from './db/challenges.ts';
import { cancelLobby, lobbySeen } from './db/live.ts';
import { inviteeOf } from './friend-challenge.ts';
import { ApiError, type Deps } from './http.ts';
import { CURRENT_RULESET, rulesetSim } from './rulesets.ts';
import { checkBetween, checkNotLive } from './one-game.ts';
import { createSeries } from './series-service.ts';
import { openStart } from './start.ts';

/** How many series by turns a player may have open at once (ADR 0052 section 11, decided). */
export const MOST_OPEN_SERIES = 3;

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
  // By turns to a friend only where the playtest switch is on (ADR 0085).
  if (request.friend !== undefined && !request.live && !deps.config.turns) {
    throw new ApiError(400, 'bad_request', 'A challenge to a friend is live');
  }
  const friend = request.friend;
  const token = await tokenFor(deps.config, creator, request.requestId);
  const hash = await hashOf(token);
  return deps.sql.begin(async (db) => {
    // A retry after a lost answer: the same link.
    const existing = await challengeByHash(db, hash);
    if (existing !== undefined) return linkOf(token, existing);
    // A challenge to a friend (ADR 0079 PR (d)): only an accepted friend of an account.
    const invitee =
      friend === undefined
        ? undefined
        : await inviteeOf(db, deps.config, { userId: creator, account }, friend);
    // The sender (and the friend) held in one order: one outgoing challenge and one live match per
    // player on any host, and two friends challenging each other at once wait in turn.
    await lockPlayers(db, invitee === undefined ? [creator] : [creator, invitee]);
    if (request.live && invitee !== undefined) {
      // Crossed (ADR 0086): their lobby waits for the sender, so sending is accepting it.
      const theirs = await lobbyWaitingFor(db, invitee, creator);
      if (theirs !== undefined) return crossedSend(db, deps.config, theirs, creator);
    }
    // Nothing new while picking lineups or in a live match, live or by turns (ADR 0089 addendum);
    // the sender's own lobby is called off below. Nor a second thing between the same two.
    await checkNotLive(db, deps.config, creator, true);
    if (invitee !== undefined) await checkBetween(db, creator, invitee, !request.live);
    await insertChallenge(db, {
      tokenHash: hash,
      creator,
      ruleset: CURRENT_RULESET,
      format: request.format,
      bestOf: request.bestOf,
      lineup: request.lineup ?? null,
      requestId: request.requestId,
      live: request.live,
      ...(invitee === undefined ? {} : { invitee }),
    });
    const made = await challengeByHash(db, hash);
    if (made === undefined) throw new Error('A challenge just made is missing');
    // One outgoing challenge: the older ones stop now, and their friends are poked.
    await supersedeOutgoing(db, creator, made.id);
    return linkOf(token, made);
  });
}

function linkOf(
  token: string,
  made: Pick<ChallengeRow, 'format' | 'bestOf' | 'expiresAt'>,
  startId?: string,
): ChallengeLink {
  return {
    token,
    format: made.format,
    bestOf: made.bestOf,
    expiresAt: made.expiresAt.toISOString(),
    ...(startId === undefined ? {} : { startId }),
  };
}

/**
 * A live challenge sent to a friend whose own lobby waits for the sender (crossed): their challenge
 * is accepted instead, on its rules (it came first); the sender's other challenges stop, and both
 * go to the lineups. The answer names that lobby's link and the start. A retry of the same send
 * after a lost answer finds the sender in those lineups and is told so (`in_a_match`).
 */
async function crossedSend(
  db: TransactionSql,
  config: Config,
  theirsId: string,
  sender: string,
): Promise<ChallengeLink> {
  const theirs = await challengeById(db, theirsId, true);
  if (theirs === undefined) throw new Error('A crossed lobby just found is missing');
  await supersedeOutgoing(db, sender, undefined);
  await checkNotLive(db, config, sender);
  const startId = await openStart(db, {
    players: { a: theirs.creator, b: sender },
    format: theirs.format,
    bestOf: theirs.bestOf,
  });
  await markStarted(db, theirs.id, startId);
  return linkOf(await tokenFor(config, theirs.creator, theirs.requestId), theirs, startId);
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
  // The viewer blocked its sender (ADR 0086): their card says so, with Unblock. The sender is never
  // told anything (a block reads as nothing to them).
  const blocked =
    viewer === undefined || own ? undefined : await blockedBy(deps.sql, viewer, found.creator);
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
    superseded: own && found.superseded,
    blocked: blocked ?? null,
  };
}

/**
 * Accepts a link, the challenger as side A. A live link starts the lineups (ADR 0080): both pick at
 * once, and the series is made when both are in. Once only: a retry by the same friend gets the
 * same start (or series); anyone else is told it's taken.
 *
 * `lineup` is a series by turns': with the challenger's lineup in hand too, the series starts at
 * once. A live link takes none.
 *
 * Crossed challenges merge (ADR 0086): accepting a live link from the friend the acceptor's own
 * lobby waits for cancels that lobby in the same transaction, and both players' locks are taken in
 * one order, so two crossed Accepts at once make one pair of lineups: the second finds the first's.
 * A player who blocked the sender can't take their link (the sender is told nothing).
 */
export async function acceptChallenge(
  deps: Deps,
  token: string,
  acceptor: string,
  lineup?: readonly string[],
): Promise<Accepted> {
  const hash = await hashOf(token);
  return deps.sql.begin(async (db) => {
    const seen = await challengeByHash(db, hash);
    if (seen === undefined) throw new ApiError(404, 'not_found', 'No such challenge');
    // Both players, in one order, then the link: one live match per player on any host, and two
    // players accepting each other's challenge at once wait in turn (never a deadlock).
    await lockPlayers(db, [acceptor, seen.creator]);
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
    if ((await blockedBy(db, acceptor, found.creator)) !== undefined) {
      throw new ApiError(403, 'friend_blocked', 'You blocked this player: unblock them first');
    }
    if (found.stopped) {
      // Crossed, both accepting at once: the other's Accept merged the two into these lineups.
      const together = found.live ? await startBetween(db, acceptor, found.creator) : undefined;
      if (together !== undefined) return { seriesId: null, startId: together };
      throw new ApiError(410, 'challenge_stopped', 'Your friend stopped waiting for this match');
    }
    if (found.expired) throw new ApiError(410, 'challenge_expired', 'This challenge has expired');
    if (found.live) {
      if (lineup !== undefined) {
        throw new ApiError(400, 'bad_request', 'A live challenge is accepted without a lineup');
      }
      // The acceptor's own live challenge still waiting stops (one at a time): crossed, it was to
      // this sender and the two merge; else its friend is poked and their banner goes.
      await supersedeOutgoing(db, acceptor, undefined, true);
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
    // By turns too: not while picking lineups or in a live match (a lobby of one's own may wait),
    // and not a second series by turns with the same player.
    await checkNotLive(db, deps.config, acceptor, true);
    await checkBetween(db, acceptor, found.creator, true, true);
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
