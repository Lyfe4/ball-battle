// A rematch reaches both players wherever they are in the game (ADR 0055, 0070; playtest
// 2026-11-19: a friend tapped Rematch while the other player had gone home, and nothing told them;
// 2026-11-23: the other way round, the one who asked went home and never heard the friend's yes).
// When a live match ends on this device it is remembered for as long as a rematch of it can still
// move (rematch-watch.ts in app). Away from the rematch's own screens (the end screen and the new
// lineup, which ask for themselves), this asks the server every ASK_MS while something can still
// happen, and says so on the floating card, at once on any calm screen and never over a fight,
// where it waits until the fight is over:
//
// - the other player asks: who, the seconds left, Accept (straight to the lineup) and No thanks;
// - both said yes and this player's lineup is still to come: "Player 4821 accepted", the seconds
//   left for the lineups, and Choose lineup; home shows the way back too (`back`);
// - the new match started once this player's lineup was in: straight into it;
// - a no, or the time running out, to the one who asked and to anyone who said yes, with OK.
//
// A hidden page doesn't ask (iOS suspends it anyway) and asks at once when it is back. Every time
// is the server's: the page counts down from the time each answer carried.
import { callApi, failureKindOf } from '../app/api.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { writeOnlineSeriesParams, writeSendParams } from '../app/online-url.ts';
import {
  forgetRematchWatch,
  rememberRematchWatch,
  rematchWatchOf,
  WATCH_MS,
  type RematchWatch,
} from '../app/rematch-watch.ts';
import { decodeRematchView, type RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import { seatsOf } from '../app/online-series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createRematchNotice } from '../ui/online/rematch-notice.ts';
import { failureLine } from './online-failure-text.ts';
import { rematchBackOf, rematchNoticeOf, rematchOpen, type RematchBack } from './rematch-text.ts';

/** How often a page away from the end screen asks while a rematch can still move. */
export const ASK_MS = 2_000;
/** The seconds on the notice are redrawn this often while it shows. */
const DISPLAY_MS = 250;
/** Kept a little past the server's deadline, for clocks and a slow last read. */
const DEADLINE_MARGIN_MS = 10_000;

export interface RematchWatchHost {
  readonly storage: DeviceStorage;
  go(write: (params: URLSearchParams) => void): void;
  /** A fight is on screen: nothing may cover it, so the notice and a move wait. */
  fighting(): boolean;
  /**
   * The rematch's own screen shows for the ended series this names (its end screen, or the new
   * lineup handed in from `?rematch=`): it asks for itself, so the watch keeps quiet.
   */
  ownScreen(): string | undefined;
  /** The live series on screen, if any: the new match once it started. */
  seriesShown(): string | undefined;
  /** Home's way back changed: shown while the rematch waits on this player. */
  backChanged(back: RematchHomeBack | undefined): void;
}

/** Home's way back to a rematch (2026-11-23): where it goes and what it says. */
export interface RematchHomeBack {
  readonly kind: RematchBack;
  readonly they: string;
  open(): void;
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
  /** This device saw both say yes: an ending without a match is said to this player too. */
  let saidYes = false;
  let failure: string | undefined;
  let asking: number | undefined;
  let ticking: number | undefined;
  /** A request (a read or an answer) is out: nothing else is sent until it is back. */
  let busy = false;
  /** This watch has been asked about once: from then on, every ASK_MS (a failure too). */
  let askedOnce = false;

  const serverNow = () => (rematch === undefined ? 0 : rematch.now + Date.now() - heardAt);
  const away = () => watch !== undefined && host.ownScreen() !== watch.id;

  function forget(): void {
    if (watch !== undefined) forgetRematchWatch(host.storage, watch.id);
    watch = undefined;
    rematch = undefined;
    saidYes = false;
    failure = undefined;
    askedOnce = false;
  }

  /** The new lineup for the watched series. */
  const toLineup = (watching: RematchWatch) => {
    host.go((url) => {
      writeSendParams(url, watching.format, watching.bestOf, 'lineup', watching.id);
    });
  };

  const notice = createRematchNotice(root, lookup, {
    accept: async () => {
      const watching = watch;
      // Both said yes already: Choose lineup.
      if (watching !== undefined && rematch?.state === 'agreed') toLineup(watching);
      else await answer('yes');
    },
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

  /**
   * Takes an answer. The watch is kept as long as the rematch can move: past the offer's two
   * minutes, a yes gives the lineups a minute more, and a watch that ran out on its first guess
   * dropped a rematch still waiting for this player after a reload (2026-11-23).
   */
  function take(next: RematchView): void {
    rematch = next;
    heardAt = Date.now();
    failure = undefined;
    if (next.state === 'agreed') saidYes = true;
    const watching = watch;
    if (watching !== undefined && next.deadline !== null) {
      const until = heardAt + next.deadline - next.now + DEADLINE_MARGIN_MS;
      if (until > watching.until) {
        watch = { ...watching, until };
        rememberRematchWatch(host.storage, watch);
      }
    }
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
    // Accept takes them straight to the new lineup.
    else if (next?.state === 'agreed' && !next.lineupIn) toLineup(watching);
    render();
  }

  /** Home's way back while the rematch waits on this player, else none. */
  function homeBack(watching: RematchWatch | undefined): RematchHomeBack | undefined {
    if (watching === undefined || rematch === undefined) return undefined;
    const kind = rematchBackOf(rematch, watching.you, serverNow());
    if (kind === undefined) return undefined;
    const open =
      kind === 'lineup'
        ? () => {
            toLineup(watching);
          }
        : () => {
            host.go((url) => {
              writeOnlineSeriesParams(url, watching.id);
            });
          };
    return { kind, they: watching.they, open };
  }

  /** Shows what there is to say now, moves into a new match that started, and asks again. */
  function render(): void {
    const watching = watch;
    const said =
      watching === undefined || rematch === undefined || !away()
        ? undefined
        : rematchNoticeOf(rematch, watching.you, watching.they, serverNow(), saidYes);
    host.backChanged(away() ? homeBack(watching) : undefined);
    if (said?.kind === 'started') {
      // Already on it (its lineup screen moved in), or moved now once no fight is on.
      if (host.seriesShown() === said.seriesId) forget();
      else if (!host.fighting()) {
        forget();
        host.go((url) => {
          writeOnlineSeriesParams(url, said.seriesId);
        });
      }
      notice.show(undefined);
      host.backChanged(undefined);
      schedule();
      return;
    }
    const calm = away() && !host.fighting();
    // Nothing more can come of it, and nothing to say: the watch ends.
    if (rematch !== undefined && !rematchOpen(rematch) && said === undefined) forget();
    notice.show(calm ? said : undefined, failure);
    const counting = calm && (said?.kind === 'asked' || said?.kind === 'agreed');
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
      saidYes = false;
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
