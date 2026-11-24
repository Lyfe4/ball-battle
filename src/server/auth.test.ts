// Making a guest: Auth counts its anonymous sign-in limit against the player's own IP only when it
// gets `Sb-Forwarded-For` with a secret key (ADR 0052 section 11); anything else counts our
// function's IP, which every player shares.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signUpGuest } from './auth.ts';
import type { Config } from './config.ts';

const config = {
  supabaseUrl: 'https://auth.test',
  supabasePublishableKey: 'sb_publishable_x',
  supabaseSecretKey: 'sb_secret_x',
} as Config;

const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } };

/** Signs up a guest against a fake Auth and answers the headers it received. */
async function signUp(clientIp: string | undefined): Promise<{ headers: Headers; body: unknown }> {
  let sent: { headers: Headers; body: unknown } | undefined;
  vi.stubGlobal('fetch', (_input: string | URL, init?: RequestInit) => {
    sent = {
      headers: new Headers(init?.headers),
      body: JSON.parse(init?.body as string) as unknown,
    };
    return Promise.resolve(Response.json(session));
  });
  await signUpGuest(config, clientIp, 'ticket-1');
  if (sent === undefined) throw new Error('Auth was never called');
  return sent;
}

const headersOfSignUp = async (clientIp: string | undefined): Promise<Headers> =>
  (await signUp(clientIp)).headers;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signUpGuest', () => {
  it("forwards the player's IP as Sb-Forwarded-For, with the secret key", async () => {
    const headers = await headersOfSignUp('203.0.113.7');
    expect(headers.get('Sb-Forwarded-For')).toBe('203.0.113.7');
    expect(headers.get('apikey')).toBe('sb_secret_x');
    expect(headers.get('X-Forwarded-For')).toBeNull();
  });

  it('forwards nothing when the IP is unknown', async () => {
    const headers = await headersOfSignUp(undefined);
    expect(headers.get('Sb-Forwarded-For')).toBeNull();
    expect(headers.get('apikey')).toBe('sb_secret_x');
  });

  it('carries its ticket for the before-user-created hook (ADR 0082)', async () => {
    expect((await signUp(undefined)).body).toEqual({ data: { bb_ticket: 'ticket-1' } });
  });
});
