// When the page reads the inbox (ADR 0079, PR (d)): once at the start, then every INBOX_MS while
// the page is visible and the last answer had something to watch (a friend, a waiting request or
// an invite), and every INBOX_EXPECTING_MS while something is expected (a rematch window, a lobby
// waiting: `expecting`, 2026-11-23); never while hidden, and once at once when the page shows
// again. Anything that changes the friends (a request sent or answered) pokes it. Only the wait
// lives here.
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
  /** Reads the inbox and says whether there is anything to keep watching. */
  read(): Promise<boolean>;
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
    let watch: boolean;
    try {
      watch = await host.read();
    } catch {
      // A failed read (offline, a server error) keeps time: the next one may work.
      watch = true;
    }
    busy = false;
    if (again) {
      again = false;
      void poke();
      return;
    }
    if (isOn() && (watch || host.expecting()) && !host.hidden()) wait(cadence());
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
