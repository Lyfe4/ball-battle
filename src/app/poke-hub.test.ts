// The page's one poke socket, shared by its readers (ADR 0082): it opens with the first reader
// that wants it and closes with the last, asks `/me/poke` where to listen, stays down when pokes are
// off or the ask fails, hands pokes and up/down to every listener, and asks again after the page was
// hidden long enough for the socket to close (the flag switched off, a new key).
import { describe, expect, it } from 'vitest';
import type { PokeEvent, PokeResponse } from '../api/poke.ts';
import { createPokeHub, LINGER_MS } from './poke-hub.ts';
import { HIDDEN_CLOSE_MS, type PokePageEvents, type PokeSocketOptions } from './poke-socket.ts';

const ON = {
  url: 'ws://127.0.0.1:54321/realtime/v1/websocket',
  key: 'k',
  topic: 'p:' + 'a'.repeat(32),
};

function setup(answers: (PokeResponse | Error)[]) {
  let time = 0;
  let hidden = false;
  let events: PokePageEvents | undefined;
  let asks = 0;
  const opened: { options: PokeSocketOptions; closed: boolean }[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  const hub = createPokeHub({
    setTimer: (run, ms) => {
      expect(ms).toBe(LINGER_MS);
      nextTimer += 1;
      timers.set(nextTimer, run);
      return nextTimer as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (id) => {
      timers.delete(id as unknown as number);
    },
    ask: () => {
      asks += 1;
      const answer = answers.shift() ?? { off: true };
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    open: (options) => {
      const socket = { options, closed: false };
      opened.push(socket);
      return {
        get up() {
          return false;
        },
        close() {
          socket.closed = true;
        },
      };
    },
    page: {
      hidden: () => hidden,
      listen(given) {
        events = given;
        return () => {
          events = undefined;
        };
      },
    },
    now: () => time,
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    hub,
    opened,
    settle,
    asks: () => asks,
    listening: () => events !== undefined,
    /** LINGER_MS passes. */
    linger() {
      const due = [...timers.values()];
      timers.clear();
      for (const run of due) run();
    },
    hide(ms: number) {
      hidden = true;
      events?.visibility();
      time += ms;
      hidden = false;
      events?.visibility();
    },
  };
}

describe('the poke hub', () => {
  it('opens nothing and asks nothing until a reader wants it', async () => {
    const page = setup([ON]);
    page.hub.listen({});
    await page.settle();
    expect(page.asks()).toBe(0);
    expect(page.opened).toHaveLength(0);
    expect(page.listening()).toBe(false);
  });

  it('opens one socket for every reader, on the topic /me/poke names, and closes with the last', async () => {
    const page = setup([ON]);
    const first = page.hub.want();
    const second = page.hub.want();
    await page.settle();
    expect(page.asks()).toBe(1);
    expect(page.opened).toHaveLength(1);
    expect(page.opened[0]?.options.connection).toStrictEqual(ON);
    first();
    first();
    expect(page.opened[0]?.closed).toBe(false);
    second();
    expect(page.opened[0]?.closed).toBe(false);
    page.linger();
    expect(page.opened[0]?.closed).toBe(true);
    expect(page.listening()).toBe(false);
  });

  it('stays down, polling as before, when pokes are off or /me/poke fails', async () => {
    for (const answer of [{ off: true } as const, new Error('offline')]) {
      const page = setup([answer]);
      const states: boolean[] = [];
      page.hub.listen({ onState: (up) => states.push(up) });
      page.hub.want();
      await page.settle();
      expect(page.opened).toHaveLength(0);
      expect(page.hub.up).toBe(false);
      expect(states).toStrictEqual([]);
    }
  });

  it('hands pokes and up/down to every listener, and none to one that stopped', async () => {
    const page = setup([ON]);
    const heard: string[] = [];
    const stop = page.hub.listen({
      onPoke: (event: PokeEvent) => heard.push(`a:${event}`),
      onState: (up) => heard.push(`a:${String(up)}`),
    });
    page.hub.listen({ onPoke: (event: PokeEvent) => heard.push(`b:${event}`) });
    page.hub.want();
    await page.settle();
    const socket = page.opened[0]?.options;
    socket?.onState(true);
    expect(page.hub.up).toBe(true);
    socket?.onPoke('inbox');
    stop();
    socket?.onPoke('match');
    socket?.onState(false);
    expect(heard).toStrictEqual(['a:true', 'a:inbox', 'b:inbox', 'b:match']);
  });

  it('goes down when the last reader lets go', async () => {
    const page = setup([ON]);
    const states: boolean[] = [];
    page.hub.listen({ onState: (up) => states.push(up) });
    const release = page.hub.want();
    await page.settle();
    page.opened[0]?.options.onState(true);
    release();
    page.linger();
    expect(states).toStrictEqual([true, false]);
  });

  it('drops an answer that comes back after every reader let go', async () => {
    const page = setup([ON]);
    const release = page.hub.want();
    release();
    await page.settle();
    expect(page.opened).toHaveLength(0);
    page.linger();
  });

  it('asks again after the page was hidden long enough to close the socket, and follows the answer', async () => {
    const newKey = { ...ON, topic: 'p:' + 'b'.repeat(32) };
    const page = setup([ON, ON, newKey, { off: true }]);
    page.hub.want();
    await page.settle();
    page.hide(HIDDEN_CLOSE_MS - 1);
    await page.settle();
    expect(page.asks()).toBe(1);
    // Back after the socket closed: the same answer keeps the socket.
    page.hide(HIDDEN_CLOSE_MS);
    await page.settle();
    expect(page.asks()).toBe(2);
    expect(page.opened).toHaveLength(1);
    // A new key (Log out elsewhere): a new socket on the new topic.
    page.hide(HIDDEN_CLOSE_MS);
    await page.settle();
    expect(page.opened).toHaveLength(2);
    expect(page.opened[0]?.closed).toBe(true);
    expect(page.opened[1]?.options.connection.topic).toBe(newKey.topic);
    // Switched off: closed, down, polling as before.
    page.hide(HIDDEN_CLOSE_MS);
    await page.settle();
    expect(page.opened[1]?.closed).toBe(true);
    expect(page.hub.up).toBe(false);
  });

  it('asks again when told the player may have changed, keeping a socket whose topic is the same', async () => {
    const other = { ...ON, topic: 'p:' + 'c'.repeat(32) };
    const page = setup([ON, ON, other]);
    page.hub.refresh();
    await page.settle();
    expect(page.asks()).toBe(0);
    page.hub.want();
    await page.settle();
    page.hub.refresh();
    await page.settle();
    expect(page.opened).toHaveLength(1);
    page.hub.refresh();
    await page.settle();
    expect(page.opened).toHaveLength(2);
    expect(page.opened[1]?.options.connection.topic).toBe(other.topic);
  });

  it('keeps the socket for the next screen that wants it within a few seconds, with no new ask', async () => {
    const page = setup([ON, ON]);
    const states: boolean[] = [];
    page.hub.listen({ onState: (up) => states.push(up) });
    const lobby = page.hub.want();
    await page.settle();
    page.opened[0]?.options.onState(true);
    lobby();
    const lineup = page.hub.want();
    page.linger();
    await page.settle();
    expect(page.asks()).toBe(1);
    expect(page.opened).toHaveLength(1);
    expect(page.opened[0]?.closed).toBe(false);
    expect(states).toStrictEqual([true]);
    lineup();
    page.linger();
    expect(page.opened[0]?.closed).toBe(true);
  });
});
