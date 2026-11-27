// Usernames, logging out and deleting an account (ADR 0079, PR (b)), against the local Supabase.
// Accounts here are guests marked as accounts in SQL: rules read `account_at` alone, and the
// sign-ins themselves have their own tests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { Answer } from '../test/client.ts';
import { AWAY_AFTER_MS, GRACE_MS } from '../../api/live.ts';
import {
  playLink,
  linkInfo,
  liveRow,
  sendLive,
  silence,
  startedLive,
  tokenOf,
} from '../test/live-support.ts';
import { newPlayer, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { LIMITS } from '../rate-limit.ts';
import { me, meUsername } from './me.ts';
import { seriesList } from './series.ts';
import { session } from './session.ts';

const deps = testDeps();
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

/** Quiet for longer than a live match waits for a player to come back (ADR 0053). */
const ABANDONED_MS = AWAY_AFTER_MS + GRACE_MS + 1_000;

const code = (answer: Answer) => [answer.status, errorOf(answer.body)?.code];

let names = 0;
/** A username no other test (or run) has: the local database keeps earlier runs' players. */
const fresh = (stem = 'sam') => {
  names += 1;
  return `${stem}${String(Date.now() % 1e6)}${String(names)}`.slice(0, 15);
};

async function account(): Promise<Player> {
  const player = await newPlayer(deps);
  await admin`update game.profiles set account_at = now() where user_id = ${player.userId}`;
  return player;
}

const choose = (player: Player, username: unknown) =>
  player.browser.call(meUsername, 'PUT', '/api/v1/me/username', { username });

/** Moves the player's last choice `days` into the past. */
const ago = (player: Player, days: number) => admin`
  update game.profiles set username_set_at = now() - make_interval(days => ${days})
  where user_id = ${player.userId}`;

describe('choosing a username', () => {
  it('is for accounts: a guest is asked to sign in', async () => {
    const guest = await newPlayer(deps);
    expect(code(await choose(guest, fresh()))).toStrictEqual([403, 'not_an_account']);
  });

  it('keeps it as typed, shows it as the name, and /me says it', async () => {
    const player = await account();
    const name = `Sam_${fresh('x')}`.slice(0, 15);
    const answer = await choose(player, ` ${name} `);
    expect(answer.status).toBe(200);
    expect(answer.body).toStrictEqual({ username: name });
    const { body } = await player.browser.call(me, 'GET', '/api/v1/me');
    expect(body).toStrictEqual({ name, account: true, username: name, played: false });
  });

  it('refuses another script, a space or a length outside 3-15 with the plain rule', async () => {
    const player = await account();
    for (const bad of ['игрок', 'big sam', 'ab', 'a234567890123456', 'josé']) {
      const answer = await choose(player, bad);
      expect(code(answer)).toStrictEqual([400, 'username_invalid']);
      expect(errorOf(answer.body)?.message).toBe(
        'Letters a–z, numbers and _ only, 3–15 characters',
      );
    }
  });

  it('refuses an offensive name, also spelt with digits', async () => {
    const player = await account();
    expect(code(await choose(player, 'sh1t_head'))).toStrictEqual([400, 'username_blocked']);
  });

  it('refuses a name someone has, ignoring case', async () => {
    const first = await account();
    const second = await account();
    const name = fresh();
    expect((await choose(first, name)).status).toBe(200);
    expect(code(await choose(second, name.toUpperCase()))).toStrictEqual([409, 'username_taken']);
  });

  it('gives one name claimed twice at once to one account, and "taken" to the other', async () => {
    const [first, second] = [await account(), await account()];
    const name = fresh();
    const answers = await Promise.all([
      choose(first, name),
      second.browser.elsewhere(other).call(meUsername, 'PUT', '/api/v1/me/username', {
        username: name,
      }),
    ]);
    expect(answers.map((answer) => answer.status).sort()).toStrictEqual([200, 409]);
    expect(answers.map((answer) => errorOf(answer.body)?.code)).toContain('username_taken');
  });

  it('changes once per 30 days by the database’s clock, and the same name is no change', async () => {
    const player = await account();
    const name = fresh();
    expect((await choose(player, name)).status).toBe(200);
    expect((await choose(player, name)).status).toBe(200);
    const soon = await choose(player, fresh());
    expect(code(soon)).toStrictEqual([409, 'username_too_soon']);
    expect(errorOf(soon.body)?.message).toMatch(/again in 30 days$/);
    await ago(player, 29);
    expect(errorOf((await choose(player, fresh())).body)?.message).toMatch(/again in 1 day$/);
    await ago(player, 30);
    const later = fresh();
    expect((await choose(player, later)).body).toStrictEqual({ username: later });
    // The old name is free for anyone at once.
    expect((await choose(await account(), name)).status).toBe(200);
  });

  it('counts every try, so "taken" can’t list who plays', async () => {
    const player = await account();
    await admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values (${player.userId}, ${LIMITS.usernames.bucket},
        date_bin(interval '1 hour', now(), timestamptz '2000-01-01'), ${LIMITS.usernames.max})`;
    expect(code(await choose(player, fresh()))).toStrictEqual([429, 'rate_limited']);
  });

  it('is what the opponent sees on the live link, in the live match and in the list', async () => {
    const creator = await account();
    const name = fresh();
    await choose(creator, name);
    const friend = await newPlayer(deps);
    const token = tokenOf(await sendLive(creator));
    expect((await linkInfo(friend, token)).body).toMatchObject({ from: name });
    const id = await playLink(creator, friend, token);
    expect((await read(friend, id)).names.a).toBe(name);
    const { body } = await friend.browser.call(seriesList, 'GET', '/api/v1/series');
    const listed = (body as { series: { opponent: string }[] }).series;
    expect(listed.map((one) => one.opponent)).toContain(name);
    // A guest is still "Player 1234".
    expect((await read(creator, id)).names.b).toMatch(/^Player \d{4}$/);
  });
});

describe('logging out', () => {
  it('ends the session and keeps the account and its username', async () => {
    const player = await account();
    const name = fresh();
    await choose(player, name);
    const answer = await player.browser.call(session, 'DELETE', '/api/v1/session');
    expect(answer.status).toBe(204);
    expect(player.browser.cookie).toBeUndefined();
    const [row] = await admin<{ username: string }[]>`
      select username from game.profiles where user_id = ${player.userId}`;
    expect(row?.username).toBe(name);
  });

  it('is refused during the account’s live match, which would be lost', async () => {
    const { players } = await startedLive(deps, admin);
    await admin`update game.profiles set account_at = now() where user_id = ${players.a.userId}`;
    const answer = await players.a.browser.call(session, 'DELETE', '/api/v1/session');
    expect(code(answer)).toStrictEqual([409, 'in_a_match']);
    expect(players.a.browser.cookie).toBeDefined();
  });

  it('is not refused by a live match both players left, which its clock has ended', async () => {
    const { id, players } = await startedLive(deps, admin);
    await admin`update game.profiles set account_at = now() where user_id = ${players.a.userId}`;
    // Nobody has read the series since both went quiet: its stored status is still open.
    for (const side of ['a', 'b'] as const) await silence(admin, id, side, ABANDONED_MS);
    const answer = await players.a.browser.call(session, 'DELETE', '/api/v1/session');
    expect(answer.status).toBe(204);
    expect((await liveRow(admin, id)).status).toBe('forfeit');
  });
});

describe('deleting an account', () => {
  it('deletes it at once, and frees its username', async () => {
    const player = await account();
    const name = fresh();
    await choose(player, name);
    expect((await player.browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
    const rows = await admin`select 1 from game.profiles where user_id = ${player.userId}`;
    expect(rows).toHaveLength(0);
    expect((await choose(await account(), name)).status).toBe(200);
  });
});
