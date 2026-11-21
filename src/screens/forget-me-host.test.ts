// Forget me's request, the same in every build (ADR 0078): it deletes the guest on the server, and
// only then forgets the device; a failure keeps the guest and says why.
import { describe, expect, it } from 'vitest';
import type { DeviceStorage } from '../app/online-device.ts';
import { forgetMeHost } from './forget-me-host.ts';

function deviceWithGuest(): { storage: DeviceStorage; keys: () => string[] } {
  const items = new Map<string, string>([
    ['ballbattle.online.guest', '1'],
    ['ballbattle.speed', '2'],
    ['other.site', 'x'],
  ]);
  const store = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  };
  return { storage: () => store, keys: () => [...items.keys()] };
}

/** Forget me against a server that answers `status`; what it sent and what happened. */
async function forgetAnswered(status: number, body?: unknown) {
  const device = deviceWithGuest();
  const sent: { url: string; method: string | undefined }[] = [];
  let leftPage = false;
  const host = forgetMeHost(
    device.storage,
    () => {
      leftPage = true;
    },
    (url, init) => {
      sent.push({ url, method: init.method });
      return Promise.resolve(
        body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
      );
    },
  );
  expect(host.hasGuest()).toBe(true);
  const line = await host.forget();
  return { sent, line, leftPage, keys: device.keys() };
}

describe('Forget me', () => {
  it('deletes the guest on the server, then forgets this device and starts afresh', async () => {
    const done = await forgetAnswered(204);
    expect(done.sent).toStrictEqual([{ url: '/api/v1/me', method: 'DELETE' }]);
    expect(done).toMatchObject({ line: undefined, leftPage: true, keys: ['other.site'] });
  });

  it('forgets the device when the guest is already gone', async () => {
    const gone = await forgetAnswered(401, { error: { code: 'unauthenticated', message: 'x' } });
    expect(gone).toMatchObject({ line: undefined, leftPage: true, keys: ['other.site'] });
  });

  it('keeps the guest and says why when the server could not delete it', async () => {
    const failed = await forgetAnswered(500, { error: { code: 'internal', message: 'x' } });
    expect(failed.leftPage).toBe(false);
    expect(failed.keys).toContain('ballbattle.online.guest');
    expect(failed.line).toMatch(/couldn’t answer/);
  });
});
