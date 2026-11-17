import { afterEach, describe, expect, it, vi } from 'vitest';
import { callApi, failureKindOf, type Fetch } from './api.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** A server that never answers: the request ends only when its signal aborts it. */
const silent: Fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      reject(init.signal?.reason as Error);
    });
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('callApi', () => {
  it('reads the server’s clock from X-Now, with when the request left and came back', async () => {
    const answer = await callApi('GET', 'series/x', undefined, {}, () =>
      Promise.resolve(new Response(null, { status: 304, headers: { 'X-Now': '1700000000123' } })),
    );
    if (!answer.ok) throw new Error('expected an answer');
    expect(answer.clock?.serverNow).toBe(1_700_000_000_123);
    expect(answer.clock?.receivedAt).toBeGreaterThanOrEqual(answer.clock?.sentAt ?? Infinity);
    const plain = await callApi('GET', 'me', undefined, {}, () => Promise.resolve(json(200, {})));
    expect(plain.ok && plain.clock).toBeUndefined();
  });

  // A series answer is `private, no-cache`: left to the browser, a read without the page's own ETag
  // was revalidated from its cache and came back as the cached 200 with its old X-Now (Netlify's
  // 304 carries none), so a live page's clock froze. The page keeps its own ETags.
  it('never lets the browser’s cache answer: every call is no-store', async () => {
    const send = vi.fn<Fetch>(() => Promise.resolve(json(200, {})));
    await callApi('GET', 'series/x', undefined, {}, send);
    await callApi('POST', 'series/x/picks', { round: 0, ball: 'slime' }, {}, send);
    for (const [, init] of send.mock.calls) expect(init.cache).toBe('no-store');
  });

  it('is offline when the browser says so, without sending anything', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const send = vi.fn<Fetch>();
    const answer = await callApi('GET', 'series', undefined, {}, send);
    expect(answer).toStrictEqual({ ok: false, kind: 'offline' });
    expect(send).not.toHaveBeenCalled();
  });

  it('is offline when the request fails with no response (a network error)', async () => {
    const answer = await callApi('GET', 'series', undefined, {}, () =>
      Promise.reject(new TypeError('Load failed')),
    );
    expect(answer).toStrictEqual({ ok: false, kind: 'offline' });
  });

  it('times out, never "offline", when the server takes too long to answer', async () => {
    vi.useFakeTimers();
    const pending = callApi('GET', 'series/x', undefined, {}, silent);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toStrictEqual({ ok: false, kind: 'timeout' });
  });

  it('times out while the body is still arriving, too', async () => {
    vi.useFakeTimers();
    const send: Fetch = (_input, init) => {
      const body = new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () => {
            controller.error(init.signal?.reason);
          });
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    };
    const pending = callApi('GET', 'series/x', undefined, {}, send);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toStrictEqual({ ok: false, kind: 'timeout' });
  });

  it('answers a server error that is not ours (a gateway timeout page) as an error', async () => {
    const answer = await callApi('GET', 'series/x', undefined, {}, () =>
      Promise.resolve(new Response('<HTML>Inactivity Timeout</HTML>', { status: 504 })),
    );
    expect(answer).toMatchObject({ ok: false, kind: 'error', status: 504, code: undefined });
  });

  it('answers our own refusal with its code and message', async () => {
    const answer = await callApi('POST', 'challenges', {}, {}, () =>
      Promise.resolve(json(429, { error: { code: 'rate_limited', message: 'Slow down' } })),
    );
    expect(answer).toStrictEqual({
      ok: false,
      kind: 'error',
      status: 429,
      code: 'rate_limited',
      message: 'Slow down',
    });
  });
});

describe('failureKindOf', () => {
  it('tells offline, a timeout, a server error and a refusal apart', () => {
    expect(failureKindOf({ ok: false, kind: 'offline' })).toBe('offline');
    expect(failureKindOf({ ok: false, kind: 'timeout' })).toBe('timeout');
    const error = { ok: false, kind: 'error', code: undefined, message: '' } as const;
    expect(failureKindOf({ ...error, status: 500 })).toBe('error');
    expect(failureKindOf({ ...error, status: 502 })).toBe('error');
    expect(failureKindOf({ ...error, status: 429 })).toBe('refused');
    expect(failureKindOf({ ...error, status: 403 })).toBe('refused');
  });
});
