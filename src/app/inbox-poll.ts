// When the page reads the inbox (ADR 0079, PR (d)): once at the start, then every INBOX_MS while
// the page is visible and the last answer had something to watch (a friend, a waiting request or
// an invite); never while hidden, and once at once when the page shows again. Anything that
// changes the friends (a request sent or answered) pokes it. Only the wait lives here: swapping the
// timer for a Supabase Realtime "poke" later (ADR 0053) means calling `poke` on each message and
// keeping a slow safety read; the read and its answer stay as they are.

/** How often a visible page with friends reads the inbox. */
export const INBOX_MS = 30_000;

export interface InboxPollHost {
  /** Reads the inbox and says whether there is anything to keep watching. */
  read(): Promise<boolean>;
  /** The page is hidden (`document.hidden`). */
  hidden(): boolean;
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
}

export function createInboxPoll(host: InboxPollHost): InboxPoll {
  let on = false;
  /** Read afresh after a wait: `stop` may have run while a read was out. */
  const isOn = () => on;
  let busy = false;
  /** A poke arrived while a read was out: read again when it is back. */
  let again = false;
  let timer: number | undefined;

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
    if (isOn() && watch && !host.hidden()) {
      timer = host.setTimer(() => {
        timer = undefined;
        void poke();
      }, INBOX_MS);
    }
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
  };
}
