import { describe, expect, it } from 'vitest';
import { errorOf } from '../api/errors.ts';
import { alsoWhileOff, ApiError, endpoint, json, type Deps } from './http.ts';

const deps = { config: { online: true }, sql: {} } as unknown as Deps;
/** A deploy that has its settings but vs Friend switched off (ADR 0078). */
const off = { config: { online: false }, sql: {} } as unknown as Deps;

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

  it('answers online_off with vs Friend off, except what deletes a player (ADR 0078)', async () => {
    const ok = () => Promise.resolve(json(200, {}));
    const plain = endpoint('health', ok, () => off);
    expect((await plain(new Request('https://x.test/api/v1/health'))).status).toBe(404);

    const forget = endpoint(
      'me',
      alsoWhileOff(ok, (request) => request.method === 'DELETE'),
      () => off,
    );
    const deleting = await forget(new Request('https://x.test/api/v1/me', { method: 'DELETE' }));
    expect(deleting.status).toBe(200);
    const reading = await forget(new Request('https://x.test/api/v1/me'));
    expect(errorOf(await reading.json())?.code).toBe('online_off');

    const sweep = endpoint('sweep', alsoWhileOff(ok), () => off);
    expect((await sweep(new Request('https://x.test/'))).status).toBe(200);
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
