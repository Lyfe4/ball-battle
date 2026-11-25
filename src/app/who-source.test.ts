import { describe, expect, it } from 'vitest';
import { createVisitCache } from './visit-cache.ts';
import type { WhoAmI } from './who-am-i.ts';
import { createWhoSource } from './who-source.ts';

/** A `/me` that answers when told to, counting its calls. */
function fakeMe() {
  const waiting: ((who: WhoAmI) => void)[] = [];
  let calls = 0;
  return {
    read: () => {
      calls += 1;
      return new Promise<WhoAmI>((resolve) => waiting.push(resolve));
    },
    answer: (who: WhoAmI) => {
      waiting.shift()?.(who);
    },
    calls: () => calls,
  };
}

const account: WhoAmI = { kind: 'account', username: 'sam' };

describe('one /me', () => {
  it('is one call for two askers at once (the avatar and the screen)', async () => {
    const me = fakeMe();
    const who = createWhoSource(me.read, createVisitCache());
    const avatar = who.ask();
    const screen = who.ask();
    expect(me.calls()).toBe(1);
    me.answer(account);
    expect(await avatar).toStrictEqual(account);
    expect(await screen).toStrictEqual(account);
  });

  it('keeps a known answer for the visit, and asks again once the last has landed', async () => {
    const me = fakeMe();
    const who = createWhoSource(me.read, createVisitCache());
    expect(who.known()).toBeUndefined();
    const first = who.ask();
    me.answer(account);
    await first;
    expect(who.known()).toStrictEqual(account);
    const again = who.ask();
    expect(me.calls()).toBe(2);
    me.answer({ kind: 'account', username: 'samantha' });
    await again;
    expect(who.known()).toStrictEqual({ kind: 'account', username: 'samantha' });
  });

  it('never keeps “not known” (offline, failing)', async () => {
    const me = fakeMe();
    const who = createWhoSource(me.read, createVisitCache());
    const asked = who.ask();
    me.answer({ kind: 'unknown' });
    await asked;
    expect(who.known()).toBeUndefined();
  });

  it('drops an answer asked before who the player is changed, and shares no question across it', async () => {
    const me = fakeMe();
    const cache = createVisitCache();
    const who = createWhoSource(me.read, cache);
    const before = who.ask();
    cache.clear();
    const after = who.ask();
    expect(me.calls()).toBe(2);
    me.answer(account);
    await before;
    expect(who.known()).toBeUndefined();
    me.answer({ kind: 'none' });
    expect(await after).toStrictEqual({ kind: 'none' });
    expect(who.known()).toStrictEqual({ kind: 'none' });
  });
});
