// Live links and one live match per player (ADR 0053), against the local database: a lobby is open
// while its sender keeps asking, a player starts no second match while one is on, and a link whose
// sender stopped waiting says so.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChallengeInfo } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import { LOBBY_SEEN_MS } from '../../api/live.ts';
import {
  acceptLink,
  linkInfo,
  liveRow,
  sendLive,
  seriesOf,
  tokenOf,
} from '../test/live-support.ts';
import { newPlayer, read } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { LIMITS } from '../rate-limit.ts';
import { challengeOne, challenges } from './challenges.ts';
import { seriesList } from './series.ts';

const deps = testDeps();
/** A second function instance, with its own connection. */
const other = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await other.sql.end();
  await admin.end();
});

const code = (body: unknown) => errorOf(body)?.code;
const statusOf = (body: unknown) => (body as ChallengeInfo).status;

/** The sender's lobby last asked `ms` ago. */
const lobbyQuiet = (token: string, ms: number) =>
  admin`
    update game.challenges set creator_seen_at = now() - ${`${String(ms)} milliseconds`}::interval
    where token_hash = sha256(convert_to(${token}, 'UTF8'))`;

describe('a live link', () => {
  it('counts every series list and cancel against the player’s limits', async () => {
    const sender = await newPlayer(deps);
    const counted = async (bucket: string) => {
      const [row] = await admin<{ n: number }[]>`
        select coalesce(sum(count), 0)::int as n from game.rate_limits
        where subject = ${sender.userId} and bucket = ${bucket}`;
      return row?.n ?? 0;
    };
    const reads = await counted(LIMITS.reads.bucket);
    await sender.browser.call(seriesList, 'GET', '/api/v1/series');
    expect(await counted(LIMITS.reads.bucket)).toBe(reads + 1);

    const token = tokenOf(await sendLive(sender));
    const moves = await counted(LIMITS.moves.bucket);
    await sender.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/cancel`, {});
    expect(await counted(LIMITS.moves.bucket)).toBe(moves + 1);
  });

  it('is Reveal or Showdown only', async () => {
    const sender = await newPlayer(deps);
    const blind = await sendLive(sender, 'blind');
    expect(blind.status).toBe(400);
    expect((await sendLive(sender, 'showdown')).status).toBe(201);
  });

  it('starts a live series in which the friend is already here', async () => {
    const [sender, friend] = [await newPlayer(deps), await newPlayer(deps)];
    const token = tokenOf(await sendLive(sender));
    expect((await linkInfo(friend, token)).body).toMatchObject({ status: 'open', live: true });
    const id = seriesOf(await acceptLink(friend, token));
    expect((await liveRow(admin, id)).started).toBeNull();
    // The sender's lobby moves on to the series it started.
    expect((await linkInfo(sender, token)).body).toMatchObject({ status: 'yours', seriesId: id });
    await read(sender, id);
    expect((await liveRow(admin, id)).started).not.toBeNull();
  });

  it('stays open while its sender keeps asking, and stops for good once they don’t', async () => {
    const [sender, friend] = [await newPlayer(deps), await newPlayer(deps)];
    const token = tokenOf(await sendLive(sender));
    await lobbyQuiet(token, LOBBY_SEEN_MS - 5_000);
    // The sender's page asks: the lobby is kept open.
    expect(statusOf((await linkInfo(sender, token)).body)).toBe('yours');
    expect(statusOf((await linkInfo(friend, token)).body)).toBe('open');
    await lobbyQuiet(token, LOBBY_SEEN_MS + 1_000);
    expect(statusOf((await linkInfo(friend, token)).body)).toBe('stopped');
    // Coming back doesn't reopen it: the friend may already have been told.
    expect(statusOf((await linkInfo(sender, token)).body)).toBe('stopped');
    const late = await acceptLink(friend, token);
    expect(late.status).toBe(410);
    expect(code(late.body)).toBe('challenge_stopped');
  });
});

describe('one live match at a time', () => {
  it('refuses a second link while the sender’s lobby waits, and allows one once it stopped', async () => {
    const sender = await newPlayer(deps);
    const token = tokenOf(await sendLive(sender));
    const second = await sendLive(sender);
    expect(second.status).toBe(409);
    expect(code(second.body)).toBe('in_a_match');
    // A retry of the first create still gets its link.
    await lobbyQuiet(token, LOBBY_SEEN_MS + 1_000);
    expect((await sendLive(sender)).status).toBe(201);
  });

  it('refuses a player in a live match both sending and accepting', async () => {
    const [a, b, c] = [await newPlayer(deps), await newPlayer(deps), await newPlayer(deps)];
    seriesOf(await acceptLink(b, tokenOf(await sendLive(a))));
    expect(code((await sendLive(a)).body)).toBe('in_a_match');
    const fromC = tokenOf(await sendLive(c));
    const refused = await acceptLink(b, fromC);
    expect(refused.status).toBe(409);
    expect(code(refused.body)).toBe('in_a_match');
    // C's link is still there for someone else.
    expect(statusOf((await linkInfo(await newPlayer(deps), fromC)).body)).toBe('open');
  });

  it('refuses a player waiting in their own lobby from accepting another link', async () => {
    const [a, c] = [await newPlayer(deps), await newPlayer(deps)];
    tokenOf(await sendLive(a));
    const fromC = tokenOf(await sendLive(c));
    expect(code((await acceptLink(a, fromC)).body)).toBe('in_a_match');
  });

  it('holds when one player sends and accepts at the same moment on two hosts', async () => {
    const [a, c] = [await newPlayer(deps), await newPlayer(deps)];
    const fromC = tokenOf(await sendLive(c));
    const twin = { ...a, browser: a.browser.elsewhere(other) };
    const [sent, accepted] = await Promise.all([sendLive(a), acceptLink(twin, fromC)]);
    const ok = [sent.status, accepted.status].filter((status) => status < 300);
    expect(ok).toHaveLength(1);
  });

  it('lets a player start again once their match has ended', async () => {
    const [a, b] = [await newPlayer(deps), await newPlayer(deps)];
    const id = seriesOf(await acceptLink(b, tokenOf(await sendLive(a))));
    await admin`update game.series set status = 'forfeit', winner = 'b', turn = null,
      turn_deadline = null, turn_opens_at = null, finished_at = now() where id = ${id}`;
    expect((await sendLive(a)).status).toBe(201);
  });

  it('leaves play by turns as it was: up to three open series, a lobby allowed beside them', async () => {
    const [a, b] = [await newPlayer(deps), await newPlayer(deps)];
    const byTurns = await a.browser.call(challenges, 'POST', '/api/v1/challenges', {
      format: 'blind',
      bestOf: 3,
      lineup: ['archer', 'thorns', 'vampire'],
      requestId: crypto.randomUUID(),
    });
    expect(byTurns.status).toBe(201);
    expect((await linkInfo(b, tokenOf(byTurns))).body).toMatchObject({
      live: false,
      status: 'open',
    });
    expect((await sendLive(a)).status).toBe(201);
  });
});
