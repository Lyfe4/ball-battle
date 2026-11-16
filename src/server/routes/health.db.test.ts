import { afterAll, describe, expect, it } from 'vitest';
import { endpoint } from '../http.ts';
import { testDeps } from '../test/support.ts';
import { RULESET_VERSION } from '../current-ruleset.ts';
import { health } from './health.ts';

const deps = testDeps();
afterAll(() => deps.sql.end());

describe('GET /api/v1/health', () => {
  it('reads the database as the API role and loads the current ruleset’s frozen bundle', async () => {
    const handler = endpoint(
      'health',
      health,
      () => deps,
      () => undefined,
    );
    const response = await handler(new Request('http://localhost/api/v1/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      status: 'ok',
      database: 'ok',
      auth: 'ok',
      ruleset: RULESET_VERSION,
      failed: [],
    });
  });
});
