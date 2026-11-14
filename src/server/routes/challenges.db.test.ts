// Friend challenges against the local Supabase (ADR 0052, "Friend challenges" and section 10).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted, ChallengeInfo, ChallengeLink } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import { TestBrowser } from '../test/client.ts';
import { LINEUP_3, LINEUP_5, newPlayer, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';

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

async function send(
  from: Player,
  format = 'reveal',
  bestOf = 3,
  requestId: string = crypto.randomUUID(),
) {
  const lineup = bestOf === 3 ? LINEUP_3.a : LINEUP_5.a;
  return from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format,
    bestOf,
    lineup,
    requestId,
  });
}

const accept = (by: Player, token: string, lineup: readonly string[] = LINEUP_3.b) =>
  by.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, { lineup });

const info = (browser: TestBrowser, token: string) =>
  browser.call(challengeOne, 'GET', `/api/v1/challenges/${token}`);

describe('a friend challenge', () => {
  it('is a link that names its format and sender, and never its lineup', async () => {
    const sender = await newPlayer(deps);
    const made = await send(sender, 'showdown', 5);
    expect(made.status).toBe(201);
    const link = made.body as ChallengeLink;
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const seen = await info(new TestBrowser(deps), link.token);
    expect(seen.body).toMatchObject({ format: 'showdown', bestOf: 5, status: 'open' });
    expect(JSON.stringify(seen.body)).not.toMatch(/archer|thorns|vampire/);
  });

  it('gives the same link to a retried create, and stores only its hash', async () => {
    const sender = await newPlayer(deps);
    const requestId = crypto.randomUUID();
    const one = (await send(sender, 'reveal', 3, requestId)).body as ChallengeLink;
    const two = (await send(sender, 'reveal', 3, requestId)).body as ChallengeLink;
    expect(two.token).toBe(one.token);
    const stored = await admin`select token_hash from game.challenges where creator in (
      select user_id from game.profiles) and token_hash = digest(${one.token}, 'sha256')`;
    expect(stored).toHaveLength(1);
    const plain = await admin`select 1 from game.challenges where encode(token_hash, 'escape') like
      ${`%${one.token}%`}`;
    expect(plain).toHaveLength(0);
  });

  it('starts a series once accepted, the challenger as side A, both seeing it', async () => {
    const sender = await newPlayer(deps);
    const friend = await newPlayer(deps);
    const link = (await send(sender)).body as ChallengeLink;
    const accepted = await accept(friend, link.token);
    expect(accepted.status).toBe(200);
    const { seriesId } = accepted.body as Accepted;
    const mine = await read(sender, seriesId);
    expect(mine.you).toBe('a');
    expect(mine.lineups).toStrictEqual({ a: LINEUP_3.a, b: LINEUP_3.b });
    expect((await read(friend, seriesId)).you).toBe('b');
    expect((await info(sender.browser, link.token)).body).toMatchObject({
      status: 'yours',
      seriesId,
    });
  });

  it('is accepted once: a second friend is told it is taken, the first friend’s retry gets the series', async () => {
    const sender = await newPlayer(deps);
    const [first, second] = [await newPlayer(deps), await newPlayer(deps)];
    const link = (await send(sender)).body as ChallengeLink;
    // Each on its own function instance, as two phones would be.
    const both = await Promise.all([
      accept(first, link.token),
      accept({ ...second, browser: second.browser.elsewhere(other) }, link.token),
    ]);
    const won = both.findIndex((answer) => answer.status === 200);
    expect(won).toBeGreaterThanOrEqual(0);
    expect(code(both[1 - won]?.body)).toBe('challenge_taken');
    const winner = won === 0 ? first : second;
    const again = await accept(winner, link.token);
    expect(again.body).toStrictEqual(both[won]?.body);
    expect((await info(winner.browser, link.token)).body as ChallengeInfo).toMatchObject({
      status: 'accepted',
    });
    const [{ count } = { count: 0 }] = await admin<{ count: number }[]>`
      select count(*)::int as count from game.series where player_a = ${sender.userId}`;
    expect(count).toBe(1);
  });

  it('refuses the sender’s own acceptance, an expired link, and a wrong lineup', async () => {
    const sender = await newPlayer(deps);
    const friend = await newPlayer(deps);
    const link = (await send(sender)).body as ChallengeLink;
    expect(code((await accept(sender, link.token, LINEUP_3.b)).body)).toBe('own_challenge');
    expect(code((await accept(friend, link.token, ['archer', 'archer', 'frost'])).body)).toBe(
      'bad_request',
    );
    expect(code((await accept(friend, link.token, LINEUP_5.b)).body)).toBe('bad_request');
    await admin`update game.challenges set expires_at = now() - interval '1 second'
      where token_hash = digest(${link.token}, 'sha256')`;
    expect(code((await accept(friend, link.token)).body)).toBe('challenge_expired');
    expect((await info(friend.browser, link.token)).body).toMatchObject({ status: 'expired' });
  });

  it('needs a guest to send or accept, and answers 404 for a token nobody made', async () => {
    const nobody = new TestBrowser(deps);
    expect((await nobody.call(challenges, 'POST', '/api/v1/challenges', {})).status).toBe(401);
    expect((await info(nobody, 'A'.repeat(22))).status).toBe(404);
  });

  it('lets a player keep at most 5 links out, though a retry of one still answers', async () => {
    const sender = await newPlayer(deps);
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
    for (const id of ids) expect((await send(sender, 'reveal', 3, id)).status).toBe(201);
    expect((await send(sender, 'reveal', 3, ids[4])).status).toBe(201);
    expect(code((await send(sender)).body)).toBe('too_many_series');
  });

  it('lets a player keep at most 3 open series', async () => {
    const friend = await newPlayer(deps);
    for (let n = 0; n < 3; n += 1) {
      const link = (await send(await newPlayer(deps))).body as ChallengeLink;
      expect((await accept(friend, link.token)).status).toBe(200);
    }
    const fourth = (await send(await newPlayer(deps))).body as ChallengeLink;
    expect(code((await accept(friend, fourth.token)).body)).toBe('too_many_series');
  });
});
