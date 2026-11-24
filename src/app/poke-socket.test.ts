// The poke socket (ADR 0082) against a fake WebSocket and fake timers: it joins the player's topic,
// is up only once joined, goes down on a missed heartbeat, an error or a close and comes back with
// backoff, hands on known pokes at most once a second each, and closes while the page is hidden
// or gone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PokeEvent } from '../api/poke.ts';
import {
  BACKOFF_MS,
  HEARTBEAT_MS,
  HIDDEN_CLOSE_MS,
  JOIN_TIMEOUT_MS,
  openPokeSocket,
  POKE_GAP_MS,
  type PokePage,
  type PokePageEvents,
} from './poke-socket.ts';

interface Sent {
  readonly topic: string;
  readonly event: string;
  readonly payload: unknown;
  readonly ref: string;
  readonly join_ref: string | null;
}

class FakeSocket {
  static made: FakeSocket[] = [];
  readonly sent: Sent[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.made.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Sent);
  }
  close(): void {
    this.closed = true;
  }
  /** Realtime's side: the socket opens, and answers (or not) what it was sent. */
  open(): void {
    this.onopen?.();
  }
  reply(to: Sent, status = 'ok'): void {
    this.onmessage?.({
      data: JSON.stringify({
        topic: to.topic,
        event: 'phx_reply',
        payload: { status },
        ref: to.ref,
      }),
    });
  }
  joinMessage(): Sent {
    const join = this.sent.find((message) => message.event === 'phx_join');
    if (join === undefined) throw new Error('never joined');
    return join;
  }
  broadcast(event: string, topic = 'realtime:p:0123456789abcdef0123456789abcdef'): void {
    this.onmessage?.({
      data: JSON.stringify({
        topic,
        event: 'broadcast',
        payload: { type: 'broadcast', event, payload: { id: 'x' } },
        ref: null,
      }),
    });
  }
}

const latest = (): FakeSocket => {
  const socket = FakeSocket.made.at(-1);
  if (socket === undefined) throw new Error('no socket');
  return socket;
};

class FakePage {
  hidden = false;
  listeners: PokePageEvents | undefined;
  readonly page: PokePage = {
    hidden: () => this.hidden,
    listen: (events) => {
      this.listeners = events;
      return () => {
        this.listeners = undefined;
      };
    },
  };
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.listeners?.visibility();
  }
  pageHide(): void {
    this.listeners?.pageHide();
  }
  pageShow(): void {
    this.listeners?.pageShow();
  }
}

let page: FakePage;
const connection = {
  url: 'wss://ref.supabase.co/realtime/v1/websocket',
  key: 'sb_publishable_browser',
  topic: 'p:0123456789abcdef0123456789abcdef',
};

function open() {
  const pokes: PokeEvent[] = [];
  const states: boolean[] = [];
  const socket = openPokeSocket({
    connection,
    onPoke: (event) => pokes.push(event),
    onState: (up) => states.push(up),
    WebSocket: FakeSocket as unknown as new (url: string) => WebSocket,
    page: page.page,
  });
  return { socket, pokes, states };
}

/** Opens and joins: the socket is up. */
function joined() {
  const made = open();
  latest().open();
  latest().reply(latest().joinMessage());
  return made;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.made = [];
  page = new FakePage();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('joining', () => {
  it('opens the socket with the browser key and joins the player’s public topic', () => {
    open();
    expect(latest().url).toBe(
      'wss://ref.supabase.co/realtime/v1/websocket?apikey=sb_publishable_browser&vsn=1.0.0',
    );
    latest().open();
    const join = latest().joinMessage();
    expect(join.topic).toBe('realtime:p:0123456789abcdef0123456789abcdef');
    expect(join.payload).toMatchObject({ config: { private: false, broadcast: { self: false } } });
    expect(join.join_ref).toBe(join.ref);
  });

  it('is up only once the join is answered ok, and says so once', () => {
    const { socket, states } = open();
    latest().open();
    expect(socket.up).toBe(false);
    latest().reply(latest().joinMessage());
    expect([socket.up, states]).toStrictEqual([true, [true]]);
  });

  it('stays down and tries again when the join is refused or never answered', () => {
    const { socket } = open();
    latest().open();
    latest().reply(latest().joinMessage(), 'error');
    expect(socket.up).toBe(false);
    expect(latest().closed).toBe(true);
    vi.advanceTimersByTime(BACKOFF_MS[0] ?? 0);
    expect(FakeSocket.made).toHaveLength(2);
    latest().open();
    vi.advanceTimersByTime(JOIN_TIMEOUT_MS);
    expect([socket.up, latest().closed]).toStrictEqual([false, true]);
  });
});

describe('a socket that goes bad', () => {
  it('goes down when a heartbeat is never answered, then rejoins', () => {
    const { socket, states } = joined();
    vi.advanceTimersByTime(HEARTBEAT_MS);
    const beat = latest().sent.at(-1);
    expect(beat).toMatchObject({ topic: 'phoenix', event: 'heartbeat' });
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect([socket.up, states]).toStrictEqual([false, [true, false]]);
    vi.advanceTimersByTime(BACKOFF_MS[0] ?? 0);
    latest().open();
    latest().reply(latest().joinMessage());
    expect(states).toStrictEqual([true, false, true]);
  });

  it('stays up while heartbeats are answered', () => {
    const { socket } = joined();
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(HEARTBEAT_MS);
      const beat = latest().sent.at(-1);
      if (beat !== undefined) latest().reply(beat);
    }
    expect([socket.up, FakeSocket.made.length]).toStrictEqual([true, 1]);
  });

  it('backs off 1, 2, 5, 10 then 30 s between tries, and starts again after a good join', () => {
    open();
    const waits: number[] = [];
    for (const wait of [...BACKOFF_MS, 30_000]) {
      const before = FakeSocket.made.length;
      latest().onclose?.();
      vi.advanceTimersByTime(wait - 1);
      expect(FakeSocket.made.length).toBe(before);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.made.length).toBe(before + 1);
      waits.push(wait);
    }
    expect(waits).toStrictEqual([1_000, 2_000, 5_000, 10_000, 30_000, 30_000]);
    latest().open();
    latest().reply(latest().joinMessage());
    const before = FakeSocket.made.length;
    latest().onerror?.();
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.made.length).toBe(before + 1);
  });

  it('goes down when Realtime closes the channel', () => {
    const { socket } = joined();
    latest().onmessage?.({
      data: JSON.stringify({ topic: `realtime:${connection.topic}`, event: 'phx_error' }),
    });
    expect(socket.up).toBe(false);
  });
});

describe('pokes', () => {
  it('hands on inbox and match, and ignores anything else or another topic', () => {
    const { pokes } = joined();
    latest().broadcast('inbox');
    vi.advanceTimersByTime(POKE_GAP_MS);
    latest().broadcast('match');
    latest().broadcast('presence');
    latest().broadcast('match', 'realtime:p:ffffffffffffffffffffffffffffffff');
    latest().onmessage?.({ data: 'not json' });
    expect(pokes).toStrictEqual(['inbox', 'match']);
  });

  it('coalesces a flood into one of each a second, the last one never lost', () => {
    const { pokes } = joined();
    for (let i = 0; i < 50; i += 1) latest().broadcast('match');
    latest().broadcast('inbox');
    expect(pokes).toStrictEqual(['match', 'inbox']);
    vi.advanceTimersByTime(POKE_GAP_MS - 1);
    expect(pokes).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(pokes).toStrictEqual(['match', 'inbox', 'match']);
    vi.advanceTimersByTime(5 * POKE_GAP_MS);
    expect(pokes).toHaveLength(3);
  });
});

describe('the page', () => {
  it('keeps the socket through a quick app switch, closes it after 10 s hidden, reopens on show', () => {
    const { socket, states } = joined();
    page.setHidden(true);
    vi.advanceTimersByTime(HIDDEN_CLOSE_MS - 1);
    expect(socket.up).toBe(true);
    vi.advanceTimersByTime(1);
    expect([socket.up, latest().closed]).toStrictEqual([false, true]);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.made).toHaveLength(1);
    page.setHidden(false);
    expect(FakeSocket.made).toHaveLength(2);
    latest().open();
    latest().reply(latest().joinMessage());
    expect(states).toStrictEqual([true, false, true]);
  });

  it('closes on pagehide, so the page can enter the back/forward cache, and reopens on pageshow', () => {
    const { socket } = joined();
    page.pageHide();
    expect([socket.up, latest().closed]).toStrictEqual([false, true]);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.made).toHaveLength(1);
    page.pageShow();
    expect(FakeSocket.made).toHaveLength(2);
  });

  it('close() is for good: no socket, timer or listener left', () => {
    const { socket, pokes } = joined();
    latest().broadcast('match');
    latest().broadcast('match');
    socket.close();
    expect(latest().closed).toBe(true);
    vi.advanceTimersByTime(120_000);
    page.setHidden(true);
    page.setHidden(false);
    page.pageShow();
    expect([FakeSocket.made.length, pokes, page.listeners]).toStrictEqual([
      1,
      ['match'],
      undefined,
    ]);
  });

  it('opens nothing while the page is hidden', () => {
    page.hidden = true;
    open();
    expect(FakeSocket.made).toHaveLength(0);
  });
});
