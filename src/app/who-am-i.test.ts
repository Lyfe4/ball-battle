import { describe, expect, it, vi } from 'vitest';
import type { PlayerResponse } from '../api/session.ts';
import type { ApiResult } from './api.ts';
import { hasAccount, hasGuest } from './online-device.ts';
import { whoAmI } from './who-am-i.ts';

function memory(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  return () => store as unknown as Storage;
}

const answer = (body: PlayerResponse): ApiResult<PlayerResponse | undefined> => ({
  ok: true,
  status: 200,
  body,
  etag: null,
  clock: undefined,
});
const HINT = 'other=1; __Host-bb_player=1';

describe('who this device plays as', () => {
  it('asks nothing of a device with no hint and no remembered player', async () => {
    const readMe = vi.fn();
    expect(await whoAmI(memory(), 'other=1', readMe)).toStrictEqual({ kind: 'none' });
    expect(readMe).not.toHaveBeenCalled();
  });

  it('says an account that has played online is past the first series (ADR 0090)', async () => {
    const played = vi.fn();
    await whoAmI(
      memory(),
      HINT,
      () =>
        Promise.resolve(answer({ name: 'Sam_1', account: true, username: 'Sam_1', played: true })),
      played,
    );
    expect(played).toHaveBeenCalledOnce();
    // An account new to online play, and a guest, are not.
    const fresh = vi.fn();
    await whoAmI(
      memory(),
      HINT,
      () => Promise.resolve(answer({ name: 'Jo', account: true, username: null, played: false })),
      fresh,
    );
    await whoAmI(memory(), HINT, () => Promise.resolve(answer({ name: 'Player 4821' })), fresh);
    expect(fresh).not.toHaveBeenCalled();
  });

  it('trusts /me over the device keys: Safari cleared them, the cookie stayed', async () => {
    const storage = memory();
    const who = await whoAmI(storage, HINT, () =>
      Promise.resolve(answer({ name: 'Sam_1', account: true, username: 'Sam_1' })),
    );
    expect(who).toStrictEqual({ kind: 'account', username: 'Sam_1' });
    expect([hasAccount(storage), hasGuest(storage)]).toStrictEqual([true, true]);
  });

  it('reads a guest, and a remembered account the server says is gone', async () => {
    const storage = memory({ 'ballbattle.online.account': '1', 'ballbattle.online.guest': '1' });
    expect(await whoAmI(storage, '', () => Promise.resolve(answer({ name: 'P 1' })))).toStrictEqual(
      { kind: 'guest' },
    );
    expect([hasAccount(storage), hasGuest(storage)]).toStrictEqual([false, true]);
    const ended = await whoAmI(storage, '', () =>
      Promise.resolve({ ok: false, kind: 'error', status: 401, code: undefined, message: '' }),
    );
    expect(ended).toStrictEqual({ kind: 'none' });
    expect(hasGuest(storage)).toBe(false);
  });

  it('says it does not know when offline or failing, and keeps the device keys', async () => {
    const storage = memory({ 'ballbattle.online.account': '1', 'ballbattle.online.guest': '1' });
    for (const failure of [
      { ok: false, kind: 'offline' },
      { ok: false, kind: 'timeout' },
      { ok: false, kind: 'error', status: 503, code: undefined, message: 'busy' },
    ] as const) {
      expect(await whoAmI(storage, HINT, () => Promise.resolve(failure))).toStrictEqual({
        kind: 'unknown',
      });
    }
    expect([hasAccount(storage), hasGuest(storage)]).toStrictEqual([true, true]);
  });
});
