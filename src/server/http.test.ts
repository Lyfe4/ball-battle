import { describe, expect, it } from 'vitest';
import { errorOf } from '../api/errors.ts';
import { ApiError, endpoint, json, type Deps } from './http.ts';

const deps = { config: {}, sql: {} } as unknown as Deps;

describe('a route’s frame', () => {
  it('answers online_off when this deploy has no online configuration', async () => {
    const lines: string[] = [];
    const handler = endpoint(
      'health',
      () => Promise.resolve(json(200, {})),
      () => undefined,
      (line) => {
        lines.push(line);
      },
    );
    const response = await handler(new Request('https://x.test/api/v1/health'));
    expect(response.status).toBe(404);
    expect(errorOf(await response.json())?.code).toBe('online_off');
    expect(lines).toHaveLength(1);
  });

  it('sends an ApiError as its code and status, and logs the code and the user', async () => {
    const lines: string[] = [];
    const handler = endpoint(
      'series.pick',
      (_, context) => {
        context.setUser('u1');
        return Promise.reject(new ApiError(409, 'not_your_turn', 'Not your turn'));
      },
      () => deps,
      (line) => lines.push(line),
    );
    const response = await handler(new Request('https://x.test/'), { requestId: 'req-1' });
    expect(response.status).toBe(409);
    expect(response.headers.get('X-Request-Id')).toBe('req-1');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toStrictEqual({
      error: { code: 'not_your_turn', message: 'Not your turn' },
    });
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      userId: 'u1',
      error: 'not_your_turn',
      status: 409,
    });
  });

  it('hides an unexpected error behind a 500 that says nothing of it', async () => {
    const lines: string[] = [];
    const handler = endpoint(
      'boom',
      () => Promise.reject(new Error('password=hunter2 at db.internal')),
      () => deps,
      (line) => lines.push(line),
    );
    const response = await handler(new Request('https://x.test/'));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toMatch(/hunter2|db\.internal/);
    expect(lines.join('')).not.toMatch(/hunter2|db\.internal/);
  });
});
