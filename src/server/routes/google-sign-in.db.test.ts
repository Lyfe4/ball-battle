// Google sign-in through our own callback (ADR 0079), against the local database, with Google and
// Supabase's ID-token grant stood in for (test/google-support.ts). Each check the callback makes
// (state, PKCE, nonce, one use) has a test that fails with that check removed: Supabase must never
// be asked for a session past a failed one.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OAUTH_COOKIE } from '../sign-in.ts';
import { TestBrowser, type Answer } from '../test/client.ts';
import {
  fakeGoogle,
  refusalAnswer,
  sessionAnswer,
  tokensOf,
  type FakeGoogle,
} from '../test/google-support.ts';
import { startedLive } from '../test/live-support.ts';
import { newPlayer, userIdOf, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { authGoogle, authGoogleCallback } from './auth.ts';

const deps = testDeps();
const admin = adminSql();
let google: FakeGoogle;
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const resultOf = (answer: Answer): string | null => {
  const location = answer.headers.get('Location') ?? '';
  return new URL(location, 'https://ballbattle.test').searchParams.get('google');
};

/** Starts a Google sign-in on `browser`: where it sends the browser (Google's consent). */
async function start(browser: TestBrowser, adult = false): Promise<string> {
  const answer = await browser.call(
    authGoogle,
    'GET',
    `/api/v1/auth/google${adult ? '?adult=1' : ''}`,
  );
  expect(answer.status).toBe(303);
  return answer.headers.get('Location') ?? '';
}

const callback = (browser: TestBrowser, path: string) =>
  browser.call(authGoogleCallback, 'GET', path);

async function finish(browser: TestBrowser, path: string): Promise<string | null> {
  return resultOf(await callback(browser, path));
}

/** A real player whose session the stand-in grant hands out, as if Google's account were theirs. */
async function someone(): Promise<Player> {
  return newPlayer(deps);
}

describe('a new device', () => {
  it('reaches Supabase only once the state, PKCE and nonce pass, then is signed in', async () => {
    google = fakeGoogle();
    const owner = await someone();
    google.answer(() => sessionAnswer(owner.userId, tokensOf(owner.browser.cookie ?? '')));
    const browser = new TestBrowser(deps, '198.51.100.80');
    const location = await start(browser, true);
    const to = new URL(location);
    expect(to.origin).toBe('https://accounts.google.com');
    expect(to.searchParams.get('scope')).toBe('openid email');
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    expect(to.searchParams.get('redirect_uri')).toBe(
      'https://ballbattle.test/api/v1/auth/google/callback',
    );

    expect(await finish(browser, google.consent(location))).toBe('signed_in');
    const [grant] = google.grants;
    // The raw nonce goes to Supabase, Google's access token beside the ID token, and no link.
    const raw = String(grant?.body['nonce']);
    const hashed = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)),
    ).toString('hex');
    expect(hashed).toBe(to.searchParams.get('nonce'));
    expect(grant?.body['access_token']).toBe('google-access');
    expect(grant?.body['link_identity']).toBeUndefined();
    expect(userIdOf(browser.cookie ?? '')).toBe(owner.userId);
    expect(browser.jar.has(OAUTH_COOKIE)).toBe(false);
  });

  it('starts only after the 16+ question', async () => {
    fakeGoogle();
    const answer = await new TestBrowser(deps, '198.51.100.81').call(
      authGoogle,
      'GET',
      '/api/v1/auth/google',
    );
    expect(resultOf(answer)).toBe('expired');
  });
});

describe('the callback refuses, never asking Supabase', () => {
  it('a state that isn’t the one it sent (login CSRF)', async () => {
    google = fakeGoogle();
    const browser = new TestBrowser(deps, '198.51.100.82');
    const location = await start(browser, true);
    const path = google.consent(location).replace(/state=[^&]+/, 'state=someone-elses');
    expect(await finish(browser, path)).toBe('expired');
    expect(google.exchanges).toHaveLength(0);
    expect(google.grants).toHaveLength(0);
  });

  it('no cookie, or one past its 10 minutes', async () => {
    google = fakeGoogle();
    const browser = new TestBrowser(deps, '198.51.100.83');
    const location = await start(browser, true);
    const path = google.consent(location);
    const without = new TestBrowser(deps, '198.51.100.83');
    expect(await finish(without, path)).toBe('expired');

    const late = new TestBrowser(deps, '198.51.100.84');
    const lateLocation = await start(late, true);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 11 * 60 * 1000 });
    expect(await finish(late, google.consent(lateLocation))).toBe('expired');
    expect(google.grants).toHaveLength(0);
  });

  it('a code that its verifier doesn’t answer (PKCE: a code from another sign-in)', async () => {
    google = fakeGoogle();
    const victim = new TestBrowser(deps, '198.51.100.85');
    const attacker = new TestBrowser(deps, '198.51.100.86');
    const victimLocation = await start(victim, true);
    const attackerAt = new URL(await start(attacker, true));
    // A code from the victim's consent, carrying the attacker's own nonce so only PKCE can tell
    // (the nonce check alone would catch a plain swap), finished on the attacker's device.
    const stolen = new URL(
      google.consent(victimLocation, { nonce: attackerAt.searchParams.get('nonce') ?? '' }),
      'https://ballbattle.test',
    );
    stolen.searchParams.set('state', attackerAt.searchParams.get('state') ?? '');
    expect(await finish(attacker, `${stolen.pathname}${stolen.search}`)).toBe('failed');
    expect(google.exchanges).toHaveLength(1);
    expect(google.grants).toHaveLength(0);
  });

  it('an ID token that doesn’t carry its nonce (a replayed token)', async () => {
    google = fakeGoogle();
    const browser = new TestBrowser(deps, '198.51.100.87');
    const location = await start(browser, true);
    expect(await finish(browser, google.consent(location, { nonce: 'another' }))).toBe('failed');
    expect(google.grants).toHaveLength(0);
  });

  it('a second use of its cookie, even a copy the browser was told to drop', async () => {
    google = fakeGoogle();
    const owner = await someone();
    google.answer(() => sessionAnswer(owner.userId, tokensOf(owner.browser.cookie ?? '')));
    const browser = new TestBrowser(deps, '198.51.100.88');
    const location = await start(browser, true);
    const copy = browser.elsewhere(deps);
    expect(await finish(browser, google.consent(location))).toBe('signed_in');
    expect(await finish(copy, google.consent(location))).toBe('expired');
    expect(google.grants).toHaveLength(1);
  });

  it('a guest in a live match', async () => {
    google = fakeGoogle();
    const { players } = await startedLive(deps, admin);
    const start1 = await players.a.browser.call(authGoogle, 'GET', '/api/v1/auth/google');
    expect(resultOf(start1)).toBe('in_a_match');
    expect(google.grants).toHaveLength(0);
  });
});

describe('a guest', () => {
  it('links Google and keeps its id', async () => {
    google = fakeGoogle();
    const guest = await newPlayer(deps);
    google.answer((call) => {
      expect(call.body['link_identity']).toBe(true);
      expect(call.bearer).toBe(tokensOf(guest.browser.cookie ?? '').access);
      return sessionAnswer(guest.userId, tokensOf(guest.browser.cookie ?? ''));
    });
    const location = await start(guest.browser);
    expect(await finish(guest.browser, google.consent(location))).toBe('signed_in');
    const [row] = await admin<{ account: boolean }[]>`
      select account_at is not null as account from game.profiles where user_id = ${guest.userId}`;
    expect(row?.account).toBe(true);
  });

  it('is offered to switch when that Google account already has one', async () => {
    google = fakeGoogle();
    const guest = await newPlayer(deps);
    const owner = await someone();
    google.answer((call) =>
      call.body['link_identity'] === true
        ? refusalAnswer(422, 'identity_already_exists')
        : sessionAnswer(owner.userId, tokensOf(owner.browser.cookie ?? '')),
    );
    const location = await start(guest.browser);
    expect(await finish(guest.browser, google.consent(location))).toBe('switch');
    expect(userIdOf(guest.browser.cookie ?? '')).toBe(guest.userId);
    expect(google.grants).toHaveLength(2);
  });
});
