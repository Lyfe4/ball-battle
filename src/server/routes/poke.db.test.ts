// GET /api/v1/me/poke (ADR 0082): a player's own topic only while the functions' switch and the
// database's flag are both on, and a new topic once the session ends. Deleting a player deletes
// their key with them.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { PokeOn } from '../../api/poke.ts';
import { TestBrowser } from '../test/client.ts';
import { newEmail, nextCode } from '../test/mail.ts';
import { newPlayer, userIdOf, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { authEmail, authEmailVerify, authSwitch } from './auth.ts';
import { me } from './me.ts';
import { mePoke } from './poke.ts';
import { session } from './session.ts';

const BROWSER_KEY = 'sb_publishable_browser_test';
const deps = testDeps({ BALLBATTLE_POKE: '1', SUPABASE_BROWSER_KEY: BROWSER_KEY });
const off = testDeps();
const admin = adminSql();
let flagWas = false;

const setFlag = (on: boolean) =>
  admin`update game.flags set enabled = ${on}, changed_at = now() where name = 'poke'`;

beforeAll(async () => {
  const [row] = await admin<{ enabled: boolean }[]>`
    select enabled from game.flags where name = 'poke'`;
  flagWas = row?.enabled ?? false;
  await admin`delete from game.rate_limits`;
});
beforeEach(async () => {
  await setFlag(true);
});
afterAll(async () => {
  await setFlag(flagWas);
  await Promise.all([deps.sql.end(), off.sql.end()]);
  await admin.end();
});

const askPoke = (browser: TestBrowser) => browser.call(mePoke, 'GET', '/api/v1/me/poke');

async function keyOf(userId: string): Promise<string | undefined> {
  const [row] = await admin<{ poke_key: string }[]>`
    select poke_key from game.profiles where user_id = ${userId}`;
  return row?.poke_key;
}

/** A guest that linked an email: an account with that address. */
async function accountWith(email: string): Promise<Player> {
  const player = await newPlayer(deps);
  const sent = await player.browser.call(authEmail, 'POST', '/api/v1/auth/email', { email });
  expect(sent.status).toBe(202);
  const code = await nextCode(email);
  const answer = await player.browser.call(authEmailVerify, 'POST', '/api/v1/auth/email/verify', {
    code,
  });
  expect(answer.body).toStrictEqual({ outcome: 'signed_in' });
  return player;
}

describe('GET /me/poke', () => {
  it('gives a guest its own topic, the browser key and the socket, never stored', async () => {
    const player = await newPlayer(deps);
    const answer = await askPoke(player.browser);
    expect(answer.status).toBe(200);
    expect(answer.headers.get('Cache-Control')).toBe('private, no-store');
    const body = answer.body as PokeOn;
    expect(body).toStrictEqual({
      url: `${deps.config.supabaseUrl.replace(/^http/, 'ws')}/realtime/v1/websocket`,
      key: BROWSER_KEY,
      topic: `p:${(await keyOf(player.userId)) ?? ''}`,
    });
    expect(body.topic).not.toContain(player.userId.replaceAll('-', ''));
    expect(body.key).not.toBe(deps.config.supabasePublishableKey);
  });

  it('says off while the database flag is off', async () => {
    const player = await newPlayer(deps);
    await setFlag(false);
    expect((await askPoke(player.browser)).body).toStrictEqual({ off: true });
  });

  it('says off where the functions have no BALLBATTLE_POKE, flag or not', async () => {
    const player = await newPlayer(off);
    expect((await askPoke(player.browser)).body).toStrictEqual({ off: true });
  });

  it('needs a session', async () => {
    const answer = await askPoke(new TestBrowser(deps, '198.51.100.120'));
    expect([answer.status, errorOf(answer.body)?.code]).toStrictEqual([401, 'unauthenticated']);
  });
});

describe('the poke key', () => {
  it('is new after Log out, so the old topic goes quiet', async () => {
    const player = await accountWith(newEmail());
    const before = await keyOf(player.userId);
    const out = await player.browser.call(session, 'DELETE', '/api/v1/session');
    expect(out.status).toBe(204);
    const after = await keyOf(player.userId);
    expect(after).toMatch(/^[0-9a-f]{32}$/);
    expect(after).not.toBe(before);
  });

  it('goes with the player on Forget me and Delete account', async () => {
    const guest = await newPlayer(deps);
    const account = await accountWith(newEmail());
    for (const player of [guest, account]) {
      expect(await keyOf(player.userId)).toBeDefined();
      expect((await player.browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
      expect(await keyOf(player.userId)).toBeUndefined();
    }
  });

  it('goes with the guest on Switch, and the account keeps its own', async () => {
    const email = newEmail();
    const owner = await accountWith(email);
    const ownerKey = await keyOf(owner.userId);
    const guest = await newPlayer(deps);
    const guestTopic = ((await askPoke(guest.browser)).body as PokeOn).topic;
    const sent = await guest.browser.call(authEmail, 'POST', '/api/v1/auth/email', { email });
    expect(sent.status).toBe(202);
    const code = await nextCode(email, 1);
    await guest.browser.call(authEmailVerify, 'POST', '/api/v1/auth/email/verify', { code });
    const switched = await guest.browser.call(authSwitch, 'POST', '/api/v1/auth/switch', {});
    expect(switched.body).toStrictEqual({ outcome: 'signed_in' });
    expect(userIdOf(guest.browser.cookie ?? '')).toBe(owner.userId);
    expect(await keyOf(guest.userId)).toBeUndefined();
    const now = ((await askPoke(guest.browser)).body as PokeOn).topic;
    expect(now).toBe(`p:${ownerKey ?? ''}`);
    expect(now).not.toBe(guestTopic);
  });
});
