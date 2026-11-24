// One poke socket per page, shared by every reader that wants it (ADR 0082): the inbox while an
// account is signed in, and the online flows (a lobby, a start lineup, a live match, its end screen
// and rematch window) for anyone, guests included (decision 6). The socket opens with the first
// reader that wants it and closes with the last, so an idle guest opens none.
//
// Each reader listens for its events and for up and down: up, it waits for pokes with a slow safety
// read; down, it keeps today's timers exactly. Every move to up is a read (pokes sent while down are
// lost). Where to listen comes from `GET /me/poke` when the socket first opens and again when a page
// hidden long enough to close its socket shows again, so switching pokes off (the flag) or a new key
// (Log out) reaches an open page without a reload; off, or the read failing, is down.
//
// The last reader letting go closes the socket only after LINGER_MS: moving from one online screen
// to the next (the lobby to the lineups, a match to its end screen) keeps it, and its join.
import type { PokeEvent, PokeOn, PokeResponse } from '../api/poke.ts';
import {
  HIDDEN_CLOSE_MS,
  type PokePage,
  type PokeSocket,
  type PokeSocketOptions,
} from './poke-socket.ts';

export interface PokeListener {
  /** A poke for `event`: read now, if this reader reads on it. */
  readonly onPoke?: (event: PokeEvent) => void;
  /** Up (wait for pokes, with a safety read) or down (today's timers), on each change. */
  readonly onState?: (up: boolean) => void;
}

export interface PokeHub {
  /** Whether pokes can be trusted now. */
  readonly up: boolean;
  /** This reader needs the socket (it opens with the first); the answer lets it go. */
  want(): () => void;
  /** Hears pokes and up/down until the answer is called. */
  listen(listener: PokeListener): () => void;
  /** The player may have changed (a sign-in, a switch): ask `/me/poke` again, if wanted. */
  refresh(): void;
}

export interface PokeHubOptions {
  /** `GET /me/poke`; a failed read is off. */
  readonly ask: () => Promise<PokeResponse>;
  readonly open: (options: PokeSocketOptions) => PokeSocket;
  readonly page: PokePage;
  readonly now?: () => number;
  readonly setTimer?: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (id: ReturnType<typeof setTimeout>) => void;
}

/** How long the socket stays open after the last reader let go, for the next screen to take. */
export const LINGER_MS = 5_000;

const sameConnection = (a: PokeOn, b: PokeOn): boolean =>
  a.url === b.url && a.key === b.key && a.topic === b.topic;

export function createPokeHub(options: PokeHubOptions): PokeHub {
  const { ask, open, page } = options;
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer =
    options.clearTimer ??
    ((id) => {
      clearTimeout(id);
    });
  /** Closing, after the last reader let go: a reader wanting it again keeps it. */
  let lingering: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<PokeListener>();
  let wants = 0;
  let up = false;
  let socket: PokeSocket | undefined;
  let connection: PokeOn | undefined;
  /** Each ask is numbered: an answer that comes back after a newer ask (or none wanted) is dropped. */
  let asked = 0;
  let hiddenAt: number | undefined;
  let stopListening: (() => void) | undefined;

  const setUp = (next: boolean): void => {
    if (up === next) return;
    up = next;
    for (const listener of [...listeners]) listener.onState?.(next);
  };

  const closeSocket = (): void => {
    socket?.close();
    socket = undefined;
    connection = undefined;
    setUp(false);
  };

  async function refresh(): Promise<void> {
    asked += 1;
    const mine = asked;
    let answer: PokeResponse;
    try {
      answer = await ask();
    } catch {
      answer = { off: true };
    }
    if (mine !== asked || wants === 0) return;
    if ('off' in answer) {
      closeSocket();
      return;
    }
    if (connection !== undefined && sameConnection(connection, answer)) return;
    closeSocket();
    connection = answer;
    socket = open({
      connection: answer,
      page,
      onPoke: (event) => {
        for (const listener of [...listeners]) listener.onPoke?.(event);
      },
      onState: setUp,
    });
  }

  const onVisibility = (): void => {
    if (page.hidden()) {
      hiddenAt = now();
      return;
    }
    const away = hiddenAt === undefined ? 0 : now() - hiddenAt;
    hiddenAt = undefined;
    // Hidden long enough for the socket to close: ask again, as a page load would.
    if (wants > 0 && away >= HIDDEN_CLOSE_MS) void refresh();
  };

  return {
    get up() {
      return up;
    },
    want() {
      wants += 1;
      if (lingering !== undefined) {
        clearTimer(lingering);
        lingering = undefined;
      } else if (wants === 1) {
        stopListening = page.listen({
          visibility: onVisibility,
          pageHide: () => undefined,
          pageShow: () => undefined,
        });
        void refresh();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        wants -= 1;
        if (wants > 0) return;
        lingering = setTimer(() => {
          lingering = undefined;
          asked += 1;
          stopListening?.();
          stopListening = undefined;
          closeSocket();
        }, LINGER_MS);
      };
    },
    refresh() {
      if (wants > 0) void refresh();
    },
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
