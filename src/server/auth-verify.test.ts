// Verifying an access token: only what is wrong with the token itself ends a session. Auth's key
// set out of reach is an outage (a 500 that keeps the cookie), and a key that was rotated away is
// left to the refresh, which a real session survives.
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionIdOf, verifyAccess } from './auth.ts';
import type { Config } from './config.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

let projects = 0;
/** A project of its own per test: verifyAccess keeps one key set per Auth URL. */
function newConfig(): Config {
  projects += 1;
  return { supabaseUrl: `https://auth-${String(projects)}.test` } as Config;
}

async function signed(
  config: Config,
  key: CryptoKey,
  kid: string,
  claims: Record<string, unknown> = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid })
    .setSubject('user-1')
    .setIssuer(`${config.supabaseUrl}/auth/v1`)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

async function keyPair(): Promise<{ privateKey: CryptoKey; jwk: Record<string, unknown> }> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  return { privateKey, jwk: { ...(await exportJWK(publicKey)), alg: 'ES256', use: 'sig' } };
}

/** Auth's key set answers `response` to every fetch. */
function keySetAnswers(response: () => Response): void {
  vi.stubGlobal('fetch', () => Promise.resolve(response()));
}

describe('verifyAccess', () => {
  it("accepts a token signed by the project's published key", async () => {
    const config = newConfig();
    const { privateKey, jwk } = await keyPair();
    keySetAnswers(() => Response.json({ keys: [{ ...jwk, kid: 'k1' }] }));
    expect(await verifyAccess(config, await signed(config, privateKey, 'k1'))).toStrictEqual({
      userId: 'user-1',
      sessionId: undefined,
    });
  });

  it('reads the Auth session a token belongs to, so Log out can end it (game.session_live)', async () => {
    const config = newConfig();
    const { privateKey, jwk } = await keyPair();
    keySetAnswers(() => Response.json({ keys: [{ ...jwk, kid: 'k1' }] }));
    const sid = '0b6f4a2e-9c1d-4e7f-8a3b-5d2c1e0f9a8b';
    const token = (session_id: unknown) => signed(config, privateKey, 'k1', { session_id });
    expect(await verifyAccess(config, await token(sid))).toStrictEqual({
      userId: 'user-1',
      sessionId: sid,
    });
    expect(sessionIdOf(await token(sid))).toBe(sid);
    // Anything but a UUID is no session id (the SQL casts it).
    expect(await verifyAccess(config, await token("x'; drop"))).toStrictEqual({
      userId: 'user-1',
      sessionId: undefined,
    });
    expect(sessionIdOf('not a token')).toBeUndefined();
  });

  it('throws, never "invalid", when the key set answers an error page', async () => {
    const config = newConfig();
    const { privateKey } = await keyPair();
    keySetAnswers(() => new Response('<h1>Service Unavailable</h1>', { status: 503 }));
    await expect(verifyAccess(config, await signed(config, privateKey, 'k1'))).rejects.toThrow();
  });

  it('throws, never "invalid", when the key set is not JSON', async () => {
    const config = newConfig();
    const { privateKey } = await keyPair();
    keySetAnswers(() => new Response('<html>maintenance</html>', { status: 200 }));
    await expect(verifyAccess(config, await signed(config, privateKey, 'k1'))).rejects.toThrow();
  });

  it('leaves a token from a rotated-away key to the refresh', async () => {
    const config = newConfig();
    const old = await keyPair();
    const current = await keyPair();
    keySetAnswers(() => Response.json({ keys: [{ ...current.jwk, kid: 'k2' }] }));
    expect(await verifyAccess(config, await signed(config, old.privateKey, 'k1'))).toBe('expired');
  });

  it('refuses a token whose signature does not match the published key', async () => {
    const config = newConfig();
    const published = await keyPair();
    const forger = await keyPair();
    keySetAnswers(() => Response.json({ keys: [{ ...published.jwk, kid: 'k1' }] }));
    expect(await verifyAccess(config, await signed(config, forger.privateKey, 'k1'))).toBe(
      'invalid',
    );
  });

  it('refuses a token for another project', async () => {
    const config = newConfig();
    const { privateKey, jwk } = await keyPair();
    keySetAnswers(() => Response.json({ keys: [{ ...jwk, kid: 'k1' }] }));
    const elsewhere = await signed(
      { supabaseUrl: 'https://other.test' } as Config,
      privateKey,
      'k1',
    );
    expect(await verifyAccess(config, elsewhere)).toBe('invalid');
  });

  it('refuses something that is not a token', async () => {
    expect(await verifyAccess(newConfig(), 'not-a-token')).toBe('invalid');
  });
});
