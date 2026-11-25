// Lineups picked together (ADR 0080): the one lineup screen after a live challenge is accepted (a
// link or a friend's card) or a rematch agreed. Both players build theirs at once against the
// server's clock, each in secret; the line under the header says whether the other is still
// choosing or ready, never their balls. Every change of the tray is sent as a draft with a rising
// sequence (so a late answer never wins over a newer one): when the clock runs out the server
// finishes a draft at random. Locked in, the screen waits for the other's, then goes into the
// match. The page only counts down to the server's deadline; the server decides.
//
// On the Realtime poke (ADR 0082, `poke-pace.ts`): with the socket up, the other's open and lock
// and the start being made arrive by poke, so the screen reads only on a poke, every SAFETY_MS and
// just after the deadline; down, every second as before.
import { callApi, type ApiFailure } from '../app/api.ts';
import { createPokePace, type PokePace } from '../app/poke-pace.ts';
import { pokes } from '../app/pokes.ts';
import { secondsUntil } from '../app/live-play.ts';
import { decodeStartView, type StartView } from '../api/start.ts';
import type { Lineup } from '../sim/series.ts';
import type { Draft } from '../ui/lineup-draft.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import type { LineupStep } from '../ui/series/lineup-step.ts';
import { startLine, startMadeLine, startWaiting } from './start-text.ts';

/** How often the screen asks while the lineups are being picked. */
const ASK_MS = 1_000;
/** With the poke socket up: a safety read this often, for a poke Realtime lost. */
export const LINEUP_SAFETY_MS = 10_000;
/** The seconds are redrawn this often. */
const TICK_MS = 250;
/** How long "Time ran out: … finished at random" shows on the way into the match. */
const MADE_NOTE_MS = 2_500;

export interface StartLineupHost {
  /** Shows the lineup step (the tray and the grid) in this screen's place. */
  showLineup(): void;
  /** Shows a notice in the lineup's place; `focus` false keeps focus where it is. */
  show(content: NoticeContent, focus: boolean): void;
  /** The screen's skeleton while the start loads on its own (a cold link, a reload). */
  loading(): void;
  intoSeries(id: string): Promise<void>;
  home(): void;
  /** A failure, as the challenge screens show one (with Try again). */
  failed(answer: ApiFailure, retry: () => Promise<unknown>): Promise<void>;
}

export interface StartLineup {
  /** Shows start `id`, read first unless it is in hand (`prime`). */
  open(id: string): void;
  /** Reads start `id` so its screen shows complete on arrival (ADR 0054). */
  prime(id: string): Promise<void>;
  /** The tray changed: sent as a draft. */
  changed(draft: Draft): void;
  /** Lock in: a request, so the button shows it is working. */
  lock(lineup: Lineup): Promise<void>;
  /** The screen went away: stop asking. */
  stop(): void;
  /** The ended series whose rematch's lineups show now, if any (it asks for itself). */
  rematchOf(): string | undefined;
}

const unfailed: ApiFailure = { ok: false, kind: 'error', status: 0, code: undefined, message: '' };

export function createStartLineup(step: LineupStep, host: StartLineupHost): StartLineup {
  let view: StartView | undefined;
  /** When `view` was answered, by this device's clock: the server's time moves on from it. */
  let heardAt = 0;
  /** The start on screen, while it shows. */
  let shown: string | undefined;
  let asking: number | undefined;
  let ticking: number | undefined;
  /** The reads' pace on the poke while a start shows; a read is out (`reading`), one more after. */
  let pace: PokePace | undefined;
  let reading = false;
  let again = false;
  /** The start whose lineup step is open (opened once: later answers change only the line). */
  let opened: string | undefined;
  /** The start this page moved into its match (once). */
  let moved: string | undefined;
  let seq = 0;
  /** A draft is out; `pending` is the newest one, sent once it is back. */
  let sending = false;
  let pending: readonly string[] | undefined;
  /** This device's own latest tray for a start: newer than any answer (a reload reads the server's). */
  let mine: { readonly id: string; readonly draft: Draft } | undefined;
  /** What the wait for the other's lineup last said. */
  let waitingShown = '';

  const serverNow = () => (view === undefined ? 0 : view.now + Date.now() - heardAt);

  function stop(): void {
    if (asking !== undefined) window.clearTimeout(asking);
    if (ticking !== undefined) window.clearInterval(ticking);
    asking = undefined;
    ticking = undefined;
    shown = undefined;
    pace?.stop();
    pace = undefined;
    again = false;
  }

  function take(next: StartView): void {
    if (view?.id !== next.id) seq = 0;
    view = next;
    heardAt = Date.now();
    seq = Math.max(seq, next.seq);
  }

  async function read(id: string): Promise<ApiFailure | undefined> {
    const answer = await callApi<unknown>('GET', `starts/${id}`);
    if (!answer.ok) return answer;
    const next = decodeStartView(answer.body);
    if (next === undefined) return unfailed;
    take(next);
    return undefined;
  }

  function intoMatch(seriesId: string): void {
    if (moved === seriesId) return;
    moved = seriesId;
    stop();
    void host.intoSeries(seriesId);
  }

  /** What shows for the start now: its lineup and line, the wait, or the way into the match. */
  function render(focus: boolean): void {
    const current = view;
    if (current === undefined || shown !== current.id) return;
    const seriesId = current.seriesId;
    if (seriesId !== null) {
      const made = startMadeLine(current);
      if (made === undefined) {
        intoMatch(seriesId);
        return;
      }
      // Both phones are told what the clock decided, then go in (or at once, with the button).
      stop();
      host.show(
        startWaiting(current, {
          made,
          home: () => {
            host.home();
          },
          go: () => {
            intoMatch(seriesId);
          },
        }),
        focus,
      );
      window.setTimeout(() => {
        intoMatch(seriesId);
      }, MADE_NOTE_MS);
      return;
    }
    const seconds = secondsUntil(current.deadline, serverNow());
    if (current.locked) {
      // Drawn again only when what it says changes (each second), never on every tick.
      const key = `${current.id}:${String(seconds)}`;
      if (key !== waitingShown || focus) {
        waitingShown = key;
        host.show(
          startWaiting(current, {
            seconds,
            home: () => {
              host.home();
            },
          }),
          focus,
        );
      }
      return;
    }
    if (opened !== current.id) {
      opened = current.id;
      host.showLineup();
      const draft = mine?.id === current.id ? mine.draft : current.draft;
      step.open(current.format, draft, undefined, current.bestOf, 'Lock in');
    }
    step.status(startLine(current, seconds));
  }

  function ask(id: string, ms?: number): void {
    const until = view?.id === id ? view.deadline - serverNow() : undefined;
    asking = window.setTimeout(
      () => {
        asking = undefined;
        reading = true;
        void read(id).then(() => {
          reading = false;
          // A failed ask keeps waiting: the next may answer.
          if (shown !== id) return;
          render(false);
          if (shown !== id) return;
          const now = again;
          again = false;
          ask(id, now ? 0 : undefined);
        });
      },
      ms ?? pace?.delay(ASK_MS, until) ?? ASK_MS,
    );
  }

  /** A poke, or the socket going up or down: read now, or once the read that is out is back. */
  function readNow(): void {
    const id = shown;
    if (id === undefined) return;
    if (reading) {
      again = true;
      return;
    }
    if (asking !== undefined) window.clearTimeout(asking);
    ask(id, 0);
  }

  function watch(id: string): void {
    render(true);
    if (shown !== id) return;
    ticking = window.setInterval(() => {
      render(false);
    }, TICK_MS);
    pace = createPokePace(pokes, LINEUP_SAFETY_MS, readNow);
    ask(id);
  }

  async function send(id: string, lineup: readonly string[]): Promise<void> {
    if (sending) {
      pending = lineup;
      return;
    }
    sending = true;
    seq += 1;
    const answer = await callApi<unknown>('POST', `starts/${id}`, { lineup, lock: false, seq });
    sending = false;
    // A draft that failed is carried by the next change, or by the lock: nothing to say.
    const next = answer.ok ? decodeStartView(answer.body) : undefined;
    if (next !== undefined && view?.id === id) take(next);
    const newer = pending;
    pending = undefined;
    if (newer !== undefined) await send(id, newer);
  }

  function open(id: string): void {
    stop();
    shown = id;
    // Shown afresh each time (back from home too): the step reopens on the server's draft.
    opened = undefined;
    waitingShown = '';
    if (view?.id === id) {
      watch(id);
      return;
    }
    host.loading();
    void read(id).then((failure) => {
      if (shown !== id) return;
      if (failure === undefined) watch(id);
      else {
        void host.failed(failure, async () => {
          open(id);
          await Promise.resolve();
        });
      }
    });
  }

  async function lock(lineup: Lineup): Promise<void> {
    const id = shown;
    if (id === undefined) return;
    seq += 1;
    const answer = await callApi<unknown>('POST', `starts/${id}`, { lineup, lock: true, seq });
    if (!answer.ok) {
      void host.failed(answer, () => lock(lineup));
      return;
    }
    const next = decodeStartView(answer.body);
    if (next !== undefined && shown === id) {
      take(next);
      render(true);
    }
  }

  return {
    open,
    async prime(id) {
      await read(id);
    },
    changed(draft) {
      const id = shown;
      if (id === undefined || view?.id !== id || view.locked || view.seriesId !== null) return;
      mine = { id, draft };
      void send(
        id,
        draft.filter((ball): ball is string => ball !== undefined),
      );
    },
    lock,
    stop,
    rematchOf: () =>
      shown !== undefined && view?.id === shown ? (view.rematchOf ?? undefined) : undefined,
  };
}
