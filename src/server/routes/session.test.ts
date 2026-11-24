import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { configOf } from '../config.ts';
import { endpoint, type Deps } from '../http.ts';
import { session } from './session.ts';

const config = configOf({
  BALLBATTLE_ONLINE: '1',
  DATABASE_URL: 'postgres://unused',
  SUPABASE_URL: 'https://auth.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  SEED_KEYS: JSON.stringify({ k: Buffer.alloc(32).toString('base64') }),
});
// The database is asked only for the sign-up's ticket (ADR 0082), which this fake accepts.
const deps = { config, sql: () => Promise.resolve([]) } as unknown as Deps;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('making a guest when Auth refuses', () => {
  it('answers guests_busy with a time to wait, never a bare 500', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 429 })));
    const handler = endpoint(
      'session',
      session,
      () => deps,
      () => undefined,
    );
    const response = await handler(
      new Request('https://site.test/api/v1/session', {
        method: 'POST',
        headers: { Origin: 'https://site.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ adult: true }),
      }),
    );
    expect(response.status).toBe(503);
    expect(errorOf(await response.json())?.code).toBe('guests_busy');
    expect(response.headers.get('Retry-After')).toBe('300');
  });
});
