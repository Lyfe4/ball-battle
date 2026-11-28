// Turnstile's server check (ADR 0079 addendum of 2026-11-28) against a fake `siteverify`: what it
// sends, and what each of Cloudflare's answers means for the player.
import { describe, expect, it } from 'vitest';
import {
  SITEVERIFY_URL,
  TURNSTILE_ACTION,
  verifyTurnstile,
  type TurnstileRequest,
} from './turnstile.ts';

const KEYS = { siteKey: '0x4AAAAAAAsite', secret: '0x4AAAAAAAsecret' };
const REQUEST: TurnstileRequest = {
  token: 'token-from-the-widget',
  ip: '203.0.113.7',
  hostname: 'ballbattle.test',
};

interface Call {
  readonly url: string;
  readonly form: URLSearchParams;
  readonly signal: AbortSignal | null | undefined;
}

/** A siteverify that answers `answer` (a body, or a whole response), and the calls it was sent. */
function fakeSiteverify(answer: unknown) {
  const calls: Call[] = [];
  const send: typeof fetch = (input, init) => {
    calls.push({
      url: input as string,
      form: init?.body as URLSearchParams,
      signal: init?.signal,
    });
    return typeof answer === 'function'
      ? (answer as () => Promise<Response>)()
      : Promise.resolve(Response.json(answer));
  };
  return { calls, send };
}

const passed = { success: true, hostname: 'ballbattle.test', action: TURNSTILE_ACTION };

describe('the Turnstile check', () => {
  it('passes a token Cloudflare accepts for this site and action, sending the secret and IP', async () => {
    const { calls, send } = fakeSiteverify(passed);
    expect(await verifyTurnstile(KEYS, REQUEST, send)).toStrictEqual({ kind: 'passed' });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(SITEVERIFY_URL);
    expect(Object.fromEntries(call?.form ?? [])).toStrictEqual({
      secret: KEYS.secret,
      response: REQUEST.token,
      remoteip: REQUEST.ip,
    });
    expect(call?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends no IP where none was seen', async () => {
    const { calls, send } = fakeSiteverify(passed);
    await verifyTurnstile(KEYS, { ...REQUEST, ip: undefined }, send);
    expect(calls[0]?.form.has('remoteip')).toBe(false);
  });

  it('refuses a missing token without asking Cloudflare', async () => {
    const { calls, send } = fakeSiteverify(passed);
    const verdict = await verifyTurnstile(KEYS, { ...REQUEST, token: undefined }, send);
    expect(verdict.kind).toBe('refused');
    expect(calls).toHaveLength(0);
  });

  it('refuses a token Cloudflare turns down: wrong, spent or expired', async () => {
    for (const code of ['invalid-input-response', 'timeout-or-duplicate']) {
      const { send } = fakeSiteverify({ success: false, 'error-codes': [code] });
      expect(await verifyTurnstile(KEYS, REQUEST, send)).toStrictEqual({
        kind: 'refused',
        detail: `siteverify: ${code}`,
      });
    }
  });

  it('refuses a token made for another site or another action', async () => {
    const elsewhere = fakeSiteverify({ ...passed, hostname: 'evil.example' });
    expect((await verifyTurnstile(KEYS, REQUEST, elsewhere.send)).kind).toBe('refused');
    const other = fakeSiteverify({ ...passed, action: 'login' });
    expect((await verifyTurnstile(KEYS, REQUEST, other.send)).kind).toBe('refused');
    const none = fakeSiteverify({ success: true, hostname: 'ballbattle.test' });
    expect((await verifyTurnstile(KEYS, REQUEST, none.send)).kind).toBe('refused');
  });

  it('skips site and action only under Cloudflare’s test secret, which answers for example.com', async () => {
    const test = {
      siteKey: '1x00000000000000000000AA',
      secret: '1x0000000000000000000000000000000AA',
    };
    // What the test secret answered when measured (2026-11-28): no action, example.com.
    const answer = { success: true, hostname: 'example.com', 'error-codes': [] };
    expect((await verifyTurnstile(test, REQUEST, fakeSiteverify(answer).send)).kind).toBe('passed');
    expect((await verifyTurnstile(KEYS, REQUEST, fakeSiteverify(answer).send)).kind).toBe(
      'refused',
    );
  });

  it('is unavailable, never passed, when Cloudflare is slow, out of reach or failing', async () => {
    const timeout = fakeSiteverify(() =>
      Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    expect(await verifyTurnstile(KEYS, REQUEST, timeout.send)).toStrictEqual({
      kind: 'unavailable',
      detail: 'siteverify unreachable (TimeoutError)',
    });
    const down = fakeSiteverify(() => Promise.reject(new TypeError('fetch failed')));
    expect((await verifyTurnstile(KEYS, REQUEST, down.send)).kind).toBe('unavailable');
    const failing = fakeSiteverify(() => Promise.resolve(new Response('oops', { status: 502 })));
    expect((await verifyTurnstile(KEYS, REQUEST, failing.send)).kind).toBe('unavailable');
    const garbled = fakeSiteverify(() => Promise.resolve(new Response('<html>')));
    expect((await verifyTurnstile(KEYS, REQUEST, garbled.send)).kind).toBe('unavailable');
  });

  it('gives up on a siteverify that never answers when its 3 s run out', async () => {
    const hanging = fakeSiteverify(() => Promise.resolve(new Response()));
    const send: typeof fetch = (input, init) =>
      new Promise((_, reject) => {
        void hanging.send(input, init);
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const started = performance.now();
    expect((await verifyTurnstile(KEYS, REQUEST, send)).kind).toBe('unavailable');
    expect(performance.now() - started).toBeGreaterThanOrEqual(2900);
  });

  it('is unavailable, not the player’s fault, when Cloudflare refuses our secret', async () => {
    for (const code of ['invalid-input-secret', 'missing-input-secret', 'internal-error']) {
      const { send } = fakeSiteverify({ success: false, 'error-codes': [code] });
      expect((await verifyTurnstile(KEYS, REQUEST, send)).kind).toBe('unavailable');
    }
  });

  it('never puts the token or the secret in what it logs', async () => {
    const answers = [
      { success: false, 'error-codes': ['invalid-input-response'] },
      { success: false, 'error-codes': ['invalid-input-secret'] },
      { ...passed, hostname: 'evil.example' },
    ];
    for (const answer of answers) {
      const verdict = await verifyTurnstile(KEYS, REQUEST, fakeSiteverify(answer).send);
      const detail = 'detail' in verdict ? verdict.detail : '';
      expect(detail).not.toContain(REQUEST.token);
      expect(detail).not.toContain(KEYS.secret);
    }
  });
});
