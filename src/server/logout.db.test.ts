// Log out ends the session at once (2026-11-28 audit, migration 20261128120000_session_live):
// Auth signs the session out, and a copy of its cookie taken before (another device, a shared
// computer, a leaked token) is refused by every route on its next request, though the access token
// in it has not expired. Before, the functions verified the token alone and it kept working for up
// to an hour. Both paths are checked: `sessionOf` (/me/poke) and `sessionWith` (/me, a series).
import { afterAll, describe, expect, it } from 'vitest';
import { session } from './routes/session.ts';
import { me, meMatch } from './routes/me.ts';
import { mePoke } from './routes/poke.ts';
import { TestBrowser } from './test/client.ts';
import { seriesOne } from './routes/series.ts';
import { newPlayer, newSeries } from './test/series-support.ts';
import { newAccount } from './test/friends-support.ts';
import { adminSql, testDeps } from './test/support.ts';

const deps = testDeps();
const admin = adminSql();

afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** Another browser holding a copy of `cookie`, as it was. */
function copyOf(cookie: string | undefined): TestBrowser {
  const copy = new TestBrowser(deps);
  copy.cookie = cookie;
  return copy;
}

describe('Log out', () => {
  it('refuses a copy of the account’s session taken before it, on every route', async () => {
    const account = await newAccount(deps, admin);
    const copy = copyOf(account.browser.cookie);
    expect((await copy.call(me, 'GET', '/api/v1/me')).status).toBe(200);

    const out = await account.browser.call(session, 'DELETE', '/api/v1/session');
    expect(out.status).toBe(204);

    const after = await copy.call(me, 'GET', '/api/v1/me');
    expect(after.status).toBe(401);
    expect((after.body as { error: { code: string } }).error.code).toBe('unauthenticated');
    expect((await copy.call(mePoke, 'GET', '/api/v1/me/poke')).status).toBe(401);
    expect((await copy.call(meMatch, 'GET', '/api/v1/me/match')).status).toBe(401);
  });

  it('refuses a copy of a guest’s session in a series read, one round trip as before', async () => {
    const a = await newPlayer(deps);
    const b = await newPlayer(deps);
    const id = await newSeries(deps, { a, b }, 'reveal');
    const path = `/api/v1/series/${id}`;
    const copy = copyOf(a.browser.cookie);
    expect((await copy.call(seriesOne, 'GET', path)).status).toBe(200);
    await a.browser.call(session, 'DELETE', '/api/v1/session');
    expect((await copy.call(seriesOne, 'GET', path)).status).toBe(401);
    // The other player plays on.
    expect((await b.browser.call(seriesOne, 'GET', path)).status).toBe(200);
  });

  it('leaves every other player’s session alone', async () => {
    const one = await newPlayer(deps);
    const someoneElse = await newPlayer(deps);
    await one.browser.call(session, 'DELETE', '/api/v1/session');
    expect((await someoneElse.browser.call(me, 'GET', '/api/v1/me')).status).toBe(200);
  });
});
