// When the page reads the inbox (ADR 0079, PR (d)): once at the start, then every INBOX_MS while
// the page is visible, signed in, whatever the last answer held (ADR 0089 addendum of 2026-11-27:
// a player with nothing to watch yet is the one a first friend request is for, so a lost poke or
// a socket down must not leave it unseen); every INBOX_EXPECTING_MS while something is expected (a
// rematch window, a lobby waiting: `expecting`, 2026-11-23); at a deadline an answer named (`soon`:
// a friend's lobby stopping); never while hidden, and once at once when the page shows again.
// Anything that changes the friends (a request sent or answered) pokes it. Only the wait lives
// here.
//
// With the Realtime poke socket up (ADR 0082, `socket(true)`), the server's `inbox` pokes call
// `poke` and the timer is only a safety read every INBOX_SAFETY_MS, expecting or not: news arrives
// by poke. Every move to up reads once (pokes sent while down are lost); the moment it goes down,
// the timers above apply again, exactly as without a socket.

/** How often a visible page with friends reads the inbox. */
export const INBOX_MS = 30_000;
/** How often while something is expected: news should arrive at once, not in 30 s. */
export const INBOX_EXPECTING_MS = 2_000;
/** How often while the poke socket is up: a safety read, for a poke Realtime lost. */
export const INBOX_SAFETY_MS = 120_000;

export interface InboxPollHost {
  /** Reads the inbox. */
  read(): Promise<unknown>;
  /** The page is hidden (`document.hidden`). */
  hidden(): boolean;
  /** Something is expected (a rematch window, a lobby waiting): read every INBOX_EXPECTING_MS. */
  expecting(): boolean;
  readonly setTimer: (run: () => void, ms: number) => number;
  readonly clearTimer: (id: number) => void;
}

export interface InboxPoll {
  /** Signed in: reads now, then keeps time. */
  start(): void;
  /** Signed out (or the page is going): no more reads. */
  stop(): void;
  /** Something changed: read now (if visible), and keep time again if it is worth it. */
  poke(): void;
  /** The page was hidden or shown (`visibilitychange`). */
  visibility(): void;
  /** Something may be expected now: a slow wait is cut to INBOX_EXPECTING_MS, without a read. */
  quicken(): void;
  /** A read within `ms` (a lobby the inbox showed stops then): sooner than the wait, never later. */
  soon(ms: number): void;
  /** The poke socket went up (read now, then the safety read) or down (today's timers again). */
  socket(up: boolean): void;
}

export function createInboxPoll(host: InboxPollHost): InboxPoll {
  let on = false;
  /** Read afresh after a wait: `stop` may have run while a read was out. */
  const isOn = () => on;
  let busy = false;
  /** A poke arrived while a read was out: read again when it is back. */
  let again = false;
  let timer: number | undefined;
  /** When the timer runs, by `Date.now()`. */
  let due = 0;
  /** The poke socket is up: pokes bring news, the timer is only a safety read. */
  let up = false;
  /** A deadline asked for while a read was out: kept for the wait after it. */
  let pending: number | undefined;

  /** How long to wait after a read worth watching. */
  const cadence = (): number =>
    up ? INBOX_SAFETY_MS : host.expecting() ? INBOX_EXPECTING_MS : INBOX_MS;

  const clear = () => {
    if (timer !== undefined) host.clearTimer(timer);
    timer = undefined;
  };

  async function poke(): Promise<void> {
    if (!on || host.hidden()) return;
    if (busy) {
      again = true;
      return;
    }
    clear();
    busy = true;
    try {
      await host.read();
    } catch {
      // A failed read (offline, a server error) keeps time: the next one may work.
    }
    busy = false;
    if (again) {
      again = false;
      void poke();
      return;
    }
    // Signed in and seen, it always keeps time: the safety read, at the least.
    if (isOn() && !host.hidden()) wait(Math.min(cadence(), pending ?? Infinity));
    pending = undefined;
  }

  function wait(ms: number): void {
    clear();
    due = Date.now() + ms;
    timer = host.setTimer(() => {
      timer = undefined;
      void poke();
    }, ms);
  }

  return {
    start() {
      on = true;
      void poke();
    },
    stop() {
      on = false;
      again = false;
      clear();
    },
    poke() {
      void poke();
    },
    visibility() {
      if (host.hidden()) clear();
      else void poke();
    },
    quicken() {
      if (up || !on || busy || host.hidden() || !host.expecting()) return;
      if (timer === undefined || due > Date.now() + INBOX_EXPECTING_MS) wait(INBOX_EXPECTING_MS);
    },
    soon(ms) {
      if (!on || host.hidden()) return;
      // A read under way schedules its own next wait; this deadline is kept for after it.
      if (busy) {
        pending = Math.min(pending ?? ms, ms);
        return;
      }
      if (timer === undefined || due > Date.now() + ms) wait(ms);
    },
    socket(next) {
      if (up === next) return;
      up = next;
      if (up) {
        void poke();
        return;
      }
      // Down: a safety wait in progress is cut to today's, without a read at once.
      if (!on || busy || host.hidden() || timer === undefined) return;
      if (due > Date.now() + cadence()) wait(cadence());
    },
  };
}
