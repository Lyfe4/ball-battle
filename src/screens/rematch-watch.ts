// A rematch reaches the other player wherever they are in the game (ADR 0055, playtest 2026-11-19:
// a friend tapped Rematch while the other player had gone home, and nothing told them). When a live
// match ends on this device it is remembered for as long as a rematch can be asked and answered
// (rematch-watch.ts in app). Away from that match's end screen (which asks for itself, every
// second), this asks the server every ASK_MS while something can still happen, and says so:
//
// - the other player asks: a notice with who, the seconds left, Accept and No thanks, shown at
//   once on any calm screen (home, a setup, the manual, a vs Bot match between fights) and never
//   over a fight, where it waits until the fight is over;
// - both said yes: straight to the new lineup (this player accepted, or asked and is away);
// - the one who asked is told a no, or the time running out, with OK.
//
// A hidden page doesn't ask (iOS suspends it anyway) and asks at once when it is back. Every time
// is the server's: the page counts down from the time each answer carried.
import { callApi, failureKindOf } from '../app/api.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { writeSendParams } from '../app/online-url.ts';
import {
  forgetRematchWatch,
  rememberRematchWatch,
  rematchWatchOf,
  WATCH_MS,
} from '../app/rematch-watch.ts';
import { decodeRematchView, type RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import { seatsOf } from '../app/online-series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createRematchNotice } from '../ui/online/rematch-notice.ts';
import { failureLine } from './online-failure-text.ts';
import { rematchNoticeOf, rematchOpen } from './rematch-text.ts';

/** How often a page away from the end screen asks while a rematch can still move. */
export const ASK_MS = 2_000;
/** The seconds on the notice are redrawn this often while it shows. */
const DISPLAY_MS = 250;

export interface RematchWatchHost {
  readonly storage: DeviceStorage;
  go(write: (params: URLSearchParams) => void): void;
  /** A fight is on screen: nothing may cover it, so the notice and a move wait. */
  fighting(): boolean;
  /** The finished live series whose end screen shows now: it shows its own rematch. */
  endScreen(): string | undefined;
}

export interface RematchWatcher {
  /** A live series ended on this device: a rematch of it may be asked from now on. */
  ended(view: SeriesView): void;
  /** The screen changed (a fight started or ended, another screen): shown or asked again. */
  refresh(): void;
}

export function createRematchWatch(
  root: HTMLElement,
  lookup: DefinitionLookup,
  host: RematchWatchHost,
): RematchWatcher {
  let watch = rematchWatchOf(host.storage, Date.now());
  let rematch: RematchView | undefined;
  /** When `rematch` was answered, by this device's clock: the server's time moves on from it. */
  let heardAt = 0;
  let failure: string | undefined;
  let asking: number | undefined;
  let ticking: number | undefined;
  /** A request (a read or an answer) is out: nothing else is sent until it is back. */
  let busy = false;
  /** This watch has been asked about once: from then on, every ASK_MS (a failure too). */
  let askedOnce = false;

  const serverNow = () => (rematch === undefined ? 0 : rematch.now + Date.now() - heardAt);
  const away = () => watch !== undefined && host.endScreen() !== watch.id;

  function forget(): void {
    if (watch !== undefined) forgetRematchWatch(host.storage, watch.id);
    watch = undefined;
    rematch = undefined;
    failure = undefined;
    askedOnce = false;
  }

  const notice = createRematchNotice(root, lookup, {
    accept: () => answer('yes'),
    decline: () => answer('no'),
    dismiss: () => {
      forget();
      render();
    },
  });

  function stopAsking(): void {
    if (asking !== undefined) window.clearTimeout(asking);
    asking = undefined;
  }

  /**
   * Asks again in ASK_MS (at once the first time) while away, visible, and something can still
   * happen. A timer already set is kept: the display tick redraws four times a second.
   */
  function schedule(): void {
    const wanted =
      away() && !document.hidden && !busy && (rematch === undefined || rematchOpen(rematch));
    if (!wanted) stopAsking();
    else {
      asking ??= window.setTimeout(
        () => {
          asking = undefined;
          void ask();
        },
        askedOnce ? ASK_MS : 0,
      );
    }
  }

  function take(next: RematchView): void {
    rematch = next;
    heardAt = Date.now();
    failure = undefined;
  }

  async function ask(): Promise<void> {
    const watching = watch;
    if (watching === undefined || busy) return;
    busy = true;
    askedOnce = true;
    const answer = await callApi<unknown>('GET', `series/${watching.id}/rematch`);
    busy = false;
    if (watch?.id !== watching.id) return;
    const next = answer.ok ? decodeRematchView(answer.body) : undefined;
    if (next !== undefined) take(next);
    // Gone (a 404 after Forget me on another device): nothing more will come of it.
    else if (!answer.ok && answer.kind === 'error' && answer.status === 404) forget();
    render();
  }

  async function answer(reply: 'yes' | 'no'): Promise<void> {
    const watching = watch;
    if (watching === undefined) return;
    stopAsking();
    busy = true;
    const sent = await callApi<unknown>('POST', `series/${watching.id}/rematch`, { answer: reply });
    busy = false;
    if (watch?.id !== watching.id) return;
    const next = sent.ok ? decodeRematchView(sent.body) : undefined;
    if (next !== undefined) take(next);
    else if (!sent.ok) {
      failure = failureLine(failureKindOf(sent), sent.kind === 'error' ? sent.message : undefined);
    }
    // A no: this player knows; nothing more to show or ask.
    if (reply === 'no' && next !== undefined) forget();
    render();
  }

  /** Shows what there is to say now, moves on when both said yes, and asks again. */
  function render(): void {
    const watching = watch;
    const said =
      watching === undefined || rematch === undefined
        ? undefined
        : rematchNoticeOf(rematch, watching.you, watching.they, serverNow());
    const calm = away() && !host.fighting();
    if (watching !== undefined && said?.kind === 'lineup' && calm) {
      forget();
      notice.show(undefined);
      host.go((url) => {
        writeSendParams(url, watching.format, watching.bestOf, 'lineup', watching.id);
      });
      return;
    }
    // Nothing more can come of it, and nothing to say: the watch ends.
    if (rematch !== undefined && !rematchOpen(rematch) && said === undefined) forget();
    notice.show(calm ? said : undefined, failure);
    const counting = calm && said?.kind === 'asked';
    if (counting && ticking === undefined) {
      ticking = window.setInterval(render, DISPLAY_MS);
    } else if (!counting && ticking !== undefined) {
      window.clearInterval(ticking);
      ticking = undefined;
    }
    schedule();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      watch ??= rematchWatchOf(host.storage, Date.now());
      void ask();
    } else stopAsking();
  });
  // A watch remembered from before a reload (the tab closed and opened again in time).
  queueMicrotask(render);

  return {
    ended(view) {
      if (view.live == null || view.status === 'open' || watch?.id === view.id) return;
      watch = {
        id: view.id,
        you: view.you,
        they: seatsOf(view).they,
        format: view.format,
        bestOf: view.bestOf,
        until: Date.now() + WATCH_MS,
      };
      rematch = undefined;
      failure = undefined;
      askedOnce = false;
      rememberRematchWatch(host.storage, watch);
      render();
    },
    refresh() {
      if (watch !== undefined && watch.until <= Date.now()) forget();
      render();
    },
  };
}
