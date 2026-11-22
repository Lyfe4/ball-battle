// Log out (ADR 0079): the server ends the session, and only then does the device forget it; a
// refusal (the account's live match) keeps everything and says why.
import { describe, expect, it } from 'vitest';
import { logOut } from './log-out.ts';

function device() {
  const items = new Map<string, string>([
    ['ballbattle.online.account', '1'],
    ['ballbattle.online.guest', '1'],
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

async function loggedOut(status: number, body?: unknown) {
  const phone = device();
  const sent: string[] = [];
  let afresh = false;
  const line = await logOut(
    phone.storage,
    () => {
      afresh = true;
    },
    (url, init) => {
      sent.push(`${init.method ?? ''} ${url}`);
      return Promise.resolve(
        body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
      );
    },
  );
  return { sent, line, afresh, keys: phone.keys() };
}

describe('Log out', () => {
  it('ends the session on the server, then forgets this device and starts afresh', async () => {
    expect(await loggedOut(204)).toStrictEqual({
      sent: ['DELETE /api/v1/session'],
      line: undefined,
      afresh: true,
      keys: ['other.site'],
    });
  });

  it('keeps everything during a live match, and says why', async () => {
    const message = 'Finish or leave your match first, then log out';
    const refused = await loggedOut(409, { error: { code: 'in_a_match', message } });
    expect(refused.line).toBe(message);
    expect(refused.afresh).toBe(false);
    expect(refused.keys).toContain('ballbattle.online.account');
  });
});
