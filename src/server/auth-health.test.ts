// Health's Auth checks name the setting to fix, and never put a key in the log line.
import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authChecks } from './auth-health.ts';
import type { Config } from './config.ts';
import { failureOf } from './failure.ts';

const PUBLISHABLE = 'sb_publishable_hunter2';
const SECRET = 'sb_secret_hunter2';
const config = {
  supabaseUrl: 'https://auth.test',
  supabasePublishableKey: PUBLISHABLE,
  supabaseSecretKey: SECRET,
} as Config;

const ecKey = { ...(await exportJWK((await generateKeyPair('ES256')).publicKey)), alg: 'ES256' };
const hsKey = { kty: 'oct', alg: 'HS256', k: 'c2VjcmV0' };

interface Project {
  readonly publishable?: string;
  readonly secret?: string;
  readonly anonymous?: boolean;
  readonly keys?: readonly object[];
}

const refused = () => new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401 });

/** A fake Auth for `project`: each endpoint checks its key as Supabase's gateway does. */
function auth(project: Project) {
  const { publishable = PUBLISHABLE, secret = SECRET, anonymous = true, keys = [ecKey] } = project;
  return (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const key = new Headers(init?.headers).get('apikey');
    if (url.pathname === '/auth/v1/.well-known/jwks.json')
      return Promise.resolve(Response.json({ keys }));
    if (url.pathname === '/auth/v1/settings') {
      return Promise.resolve(
        key === publishable
          ? Response.json({ external: { anonymous_users: anonymous } })
          : refused(),
      );
    }
    if (url.pathname === '/auth/v1/admin/users') {
      return Promise.resolve(key === secret ? Response.json({ users: [] }) : refused());
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  };
}

async function checked(project: Project) {
  vi.stubGlobal('fetch', auth(project));
  const notes: string[] = [];
  const failed = await authChecks(config, (error, stage) => notes.push(failureOf(error, stage)));
  return { failed, notes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('health’s Auth checks', () => {
  it('pass for a project set up as ADR 0052 says', async () => {
    expect(await checked({})).toStrictEqual({ failed: [], notes: [] });
  });

  it('name anonymous sign-ins being off, since no guest can be made', async () => {
    const { failed, notes } = await checked({ anonymous: false });
    expect(failed).toStrictEqual(['auth_anonymous_sign_ins']);
    expect(notes).toStrictEqual(['auth: anonymous sign-ins are off']);
  });

  it('name each key Auth refuses, never its value', async () => {
    const { failed, notes } = await checked({ publishable: 'other', secret: 'other' });
    expect(failed).toStrictEqual(['auth_publishable_key', 'auth_secret_key']);
    expect(notes).toStrictEqual([
      'auth: Supabase Auth answered 401',
      'auth: Supabase Auth answered 401',
    ]);
    expect(notes.join()).not.toContain('hunter2');
  });

  it('name signing keys a token can’t be verified with: none, or only the legacy secret', async () => {
    expect((await checked({ keys: [] })).failed).toStrictEqual(['auth_signing_keys']);
    const legacy = await checked({ keys: [hsKey] });
    expect(legacy.failed).toStrictEqual(['auth_signing_keys']);
    expect(legacy.notes[0]).toMatch(/^auth: no asymmetric signing key/);
  });

  it('name Auth once when it can’t be reached', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.reject(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })),
    );
    const notes: string[] = [];
    const failed = await authChecks(config, (error, stage) => notes.push(failureOf(error, stage)));
    expect(failed).toStrictEqual(['auth']);
    expect(notes[0]).toBe('auth: Supabase Auth unreachable (ENOTFOUND host not found (DNS))');
  });
});
