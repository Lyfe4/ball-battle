// The Realtime poke's socket (ADR 0082): our own small Phoenix channels client, no dependency
// (decision 3). It joins the player's public topic, says whether it can be trusted ("up": joined
// and its last heartbeat answered) and hands on each poke's event name. It never reads anything
// itself: on a poke, or on every move from down to up (pokes sent while down are lost), the
// screens do the read they always do. While it is down they poll exactly as before.
//
// Phoenix's JSON protocol, version 1.0.0: each message is `{ topic, event, payload, ref, join_ref }`;
// a join and a heartbeat are answered by `phx_reply` with the same `ref`. Realtime drops a socket
// that stops sending heartbeats, and replays nothing on a public channel, so a lost poke is caught
// only by the screens' own safety reads.
import { POKE_EVENTS, type PokeEvent, type PokeOn } from '../api/poke.ts';

/** No join reply within this is a socket that can't be trusted. */
export const JOIN_TIMEOUT_MS = 10_000;
/**
 * A heartbeat this often, and none answered by the next is a dead socket. realtime-js's default:
 * whether Realtime counts heartbeats as billed messages is measured before this is shortened
 * (the proposal's risk 2).
 */
export const HEARTBEAT_MS = 25_000;
/** Waits before each reconnect after a drop, the last repeated; a good join starts it again. */
export const BACKOFF_MS: readonly number[] = [1_000, 2_000, 5_000, 10_000, 30_000];
/** Hidden this long, the socket closes (a quick app switch keeps it); shown again, it reopens. */
export const HIDDEN_CLOSE_MS = 10_000;
/** At most one of each event this often, so a flood of pokes (forged ones too) is one read a second. */
export const POKE_GAP_MS = 1_000;

/** What the socket hears from the page (`poke-page.ts` in a browser; a fake in tests). */
export interface PokePageEvents {
  /** `visibilitychange`. */
  readonly visibility: () => void;
  /** `pagehide`: leaving, perhaps into the back/forward cache. */
  readonly pageHide: () => void;
  /** `pageshow`: back again. */
  readonly pageShow: () => void;
}

/** The page the socket lives on: whether it is hidden, and its lifecycle events. */
export interface PokePage {
  hidden(): boolean;
  /** Starts calling `events`; the answer stops it. */
  listen(events: PokePageEvents): () => void;
}

export interface PokeSocketOptions {
  readonly connection: PokeOn;
  /** A poke: read now. At most one of each event per `POKE_GAP_MS`. */
  readonly onPoke: (event: PokeEvent) => void;
  /** Up or down, on each change: up is joined with its heartbeat answered; down, poll as before. */
  readonly onState: (up: boolean) => void;
  readonly WebSocket?: new (url: string) => WebSocket;
  readonly page: PokePage;
}

export interface PokeSocket {
  readonly up: boolean;
  /** For good: the socket, its timers and its listeners. */
  close(): void;
}

interface Message {
  readonly topic?: unknown;
  readonly event?: unknown;
  readonly payload?: unknown;
  readonly ref?: unknown;
}

const isPokeEvent = (event: unknown): event is PokeEvent =>
  typeof event === 'string' && (POKE_EVENTS as readonly string[]).includes(event);

/** Opens the poke socket for one player's topic. */
export function openPokeSocket(options: PokeSocketOptions): PokeSocket {
  const { connection, onPoke, onState } = options;
  const Socket = options.WebSocket ?? WebSocket;
  const { page } = options;
  const channel = `realtime:${connection.topic}`;
  const url = `${connection.url}?apikey=${encodeURIComponent(connection.key)}&vsn=1.0.0`;

  let socket: WebSocket | undefined;
  let up = false;
  let closed = false;
  let ref = 0;
  let joinRef = '';
  let beatRef: string | undefined;
  let failures = 0;
  let joinTimer: ReturnType<typeof setTimeout> | undefined;
  let beatTimer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  const lastPoke = new Map<PokeEvent, number>();
  const pending = new Map<PokeEvent, ReturnType<typeof setTimeout>>();

  const setUp = (next: boolean): void => {
    if (up === next) return;
    up = next;
    onState(next);
  };

  const send = (topic: string, event: string, payload: unknown, join?: string): string => {
    ref += 1;
    const id = String(ref);
    socket?.send(JSON.stringify({ topic, event, payload, ref: id, join_ref: join ?? null }));
    return id;
  };

  const stopTimers = (): void => {
    clearTimeout(joinTimer);
    clearInterval(beatTimer);
    joinTimer = undefined;
    beatTimer = undefined;
    beatRef = undefined;
  };

  /** Drops the socket, if any, without reconnecting. */
  const drop = (): void => {
    stopTimers();
    const old = socket;
    socket = undefined;
    if (old !== undefined) {
      old.onopen = null;
      old.onmessage = null;
      old.onclose = null;
      old.onerror = null;
      old.close();
    }
    setUp(false);
  };

  /** Drops the socket and tries again after the next wait. */
  const fail = (): void => {
    drop();
    if (closed || page.hidden()) return;
    const wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)] ?? 30_000;
    failures += 1;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, wait);
  };

  const heartbeat = (): void => {
    // The last one never answered: the socket is open but dead.
    if (beatRef !== undefined) {
      fail();
      return;
    }
    beatRef = send('phoenix', 'heartbeat', {});
  };

  const poke = (event: PokeEvent): void => {
    if (pending.has(event)) return;
    const wait = (lastPoke.get(event) ?? -Infinity) + POKE_GAP_MS - Date.now();
    const deliver = (): void => {
      pending.delete(event);
      lastPoke.set(event, Date.now());
      onPoke(event);
    };
    if (wait <= 0) deliver();
    else pending.set(event, setTimeout(deliver, wait));
  };

  const receive = (data: unknown): void => {
    if (typeof data !== 'string') return;
    let message: Message;
    try {
      message = JSON.parse(data) as Message;
    } catch {
      return;
    }
    const { topic, event, payload } = message;
    if (event === 'phx_reply') {
      const status = (payload as { status?: unknown } | null)?.status;
      if (message.ref === joinRef) {
        clearTimeout(joinTimer);
        if (status !== 'ok') {
          fail();
          return;
        }
        failures = 0;
        beatTimer = setInterval(heartbeat, HEARTBEAT_MS);
        setUp(true);
      } else if (message.ref === beatRef) {
        beatRef = undefined;
      }
      return;
    }
    if (topic !== channel) return;
    if (event === 'phx_error' || event === 'phx_close') {
      fail();
      return;
    }
    if (event === 'broadcast') {
      const name = (payload as { event?: unknown } | null)?.event;
      if (isPokeEvent(name)) poke(name);
    }
  };

  function connect(): void {
    clearTimeout(retryTimer);
    if (closed || socket !== undefined || page.hidden()) return;
    const opened = new Socket(url);
    socket = opened;
    opened.onopen = () => {
      joinRef = send(
        channel,
        'phx_join',
        {
          config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false },
        },
        String(ref + 1),
      );
      joinTimer = setTimeout(fail, JOIN_TIMEOUT_MS);
    };
    opened.onmessage = (message) => {
      receive(message.data);
    };
    opened.onclose = fail;
    opened.onerror = fail;
  }

  const onVisibility = (): void => {
    clearTimeout(hiddenTimer);
    if (page.hidden()) {
      hiddenTimer = setTimeout(drop, HIDDEN_CLOSE_MS);
    } else {
      failures = 0;
      connect();
    }
  };
  // An open WebSocket can keep a page out of the back/forward cache: close it as the page goes.
  const onPageHide = (): void => {
    clearTimeout(retryTimer);
    drop();
  };
  const onPageShow = (): void => {
    connect();
  };

  const stopListening = page.listen({
    visibility: onVisibility,
    pageHide: onPageHide,
    pageShow: onPageShow,
  });
  connect();

  return {
    get up() {
      return up;
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      clearTimeout(hiddenTimer);
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      stopListening();
      drop();
    },
  };
}
