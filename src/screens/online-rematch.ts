// A rematch on the end screen of a live match (ADR 0055): asks the server where it stands every
// second while one may be asked or is under way, asks or answers it, and moves both players on:
// to the new lineup once both said yes, into the new match once it started. The server's clock
// decides; the page counts down from the time each answer carried.
import { callApi, failureKindOf } from '../app/api.ts';
import { writeSendParams } from '../app/online-url.ts';
import { decodeRematchView, type RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import { seatsOf } from '../app/online-series.ts';
import type { PickClock } from './pick-clock-text.ts';
import { rematchChoiceOf, rematchClockOf, rematchEnding } from './rematch-text.ts';
import { failureLine } from './online-failure-text.ts';

/** How often the end screen asks while a rematch may be asked or is under way. */
const ASK_MS = 1_000;

export interface RematchHost {
  /** Moves to the screen `write` describes, by the Back rules. */
  go(write: (params: URLSearchParams) => void): void;
  /** Into series `id` once it is read (ADR 0054). */
  intoSeries(id: string): Promise<void>;
  /** Something the end screen shows changed: draw it again. */
  changed(): void;
}

export interface OnlineRematch {
  /** The series on screen (a finished live one is watched) and whether the screen shows. */
  watch(view: SeriesView | undefined, visible: boolean): void;
  /** The end screen's buttons. */
  choice(): 'offer' | 'answer' | undefined;
  /** The card counting the answer or the lineups down. */
  clock(): PickClock | undefined;
  /** Why there is no rematch, or a failure; undefined otherwise. */
  note(): string | undefined;
  /** Rematch: ask, or say yes. */
  yes(): Promise<void>;
  /** No thanks. */
  no(): Promise<void>;
}

/** A live series that ended with a result: the one kind a rematch follows. */
const ended = (view: SeriesView | undefined): view is SeriesView =>
  view?.live != null && (view.status === 'finished' || view.status === 'forfeit');

export function createOnlineRematch(host: RematchHost): OnlineRematch {
  let series: SeriesView | undefined;
  let visible = false;
  let rematch: RematchView | undefined;
  /** When `rematch` was answered, by this device's clock: the server's time moves on from it. */
  let heardAt = 0;
  let failure: string | undefined;
  let timer: number | undefined;
  /** The series whose lineup or new match this page already moved to (once each). */
  let movedFor = '';

  const serverNow = () => (rematch === undefined ? 0 : rematch.now + Date.now() - heardAt);
  const live = () =>
    rematch !== undefined &&
    ((rematch.state === 'none' && rematch.offered) ||
      rematch.state === 'asked' ||
      rematch.state === 'agreed');

  function stop(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  }

  function schedule(): void {
    stop();
    if (visible && series !== undefined && (rematch === undefined || live())) {
      timer = window.setTimeout(() => void ask(), ASK_MS);
    }
  }

  /** Takes an answer, and moves on when it says so. */
  function take(next: RematchView): void {
    rematch = next;
    heardAt = Date.now();
    failure = undefined;
    const view = series;
    if (view !== undefined && visible && movedFor !== view.id) {
      if (next.state === 'agreed' && !next.lineupIn) {
        movedFor = view.id;
        host.go((url) => {
          writeSendParams(url, view.format, view.bestOf, 'lineup', view.id);
        });
      } else if (next.state === 'started' && next.seriesId !== null) {
        movedFor = view.id;
        void host.intoSeries(next.seriesId);
      }
    }
    host.changed();
  }

  async function ask(): Promise<void> {
    const view = series;
    if (view === undefined) return;
    const answer = await callApi<unknown>('GET', `series/${view.id}/rematch`);
    if (series?.id !== view.id) return;
    const next = answer.ok ? decodeRematchView(answer.body) : undefined;
    if (next !== undefined) take(next);
    schedule();
  }

  async function move(answer: 'yes' | 'no'): Promise<void> {
    const view = series;
    if (view === undefined) return;
    const sent = await callApi<unknown>('POST', `series/${view.id}/rematch`, { answer });
    if (series?.id !== view.id) return;
    const next = sent.ok ? decodeRematchView(sent.body) : undefined;
    if (next !== undefined) take(next);
    else if (!sent.ok) {
      failure = failureLine(failureKindOf(sent), sent.kind === 'error' ? sent.message : undefined);
      host.changed();
      // A refusal (out of time, a no) is read again, so both phones say the same.
      void ask();
    }
    schedule();
  }

  return {
    watch(view, shown) {
      const next = ended(view) ? view : undefined;
      const changed = next?.id !== series?.id || shown !== visible;
      if (next?.id !== series?.id) {
        rematch = undefined;
        failure = undefined;
      }
      series = next;
      visible = shown;
      if (!changed) return;
      if (series !== undefined && visible) void ask();
      else stop();
    },
    choice: () =>
      series === undefined || rematch === undefined
        ? undefined
        : rematchChoiceOf(rematch, series.you),
    clock() {
      if (series === undefined || rematch === undefined) return undefined;
      return rematchClockOf(rematch, series.you, seatsOf(series).they, serverNow());
    },
    note() {
      if (series === undefined) return undefined;
      const ending =
        rematch === undefined
          ? undefined
          : rematchEnding(rematch, series.you, seatsOf(series).they);
      return ending ?? failure;
    },
    yes: () => move('yes'),
    no: () => move('no'),
  };
}
