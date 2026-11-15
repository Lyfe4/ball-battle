// A rematch's new lineup (ADR 0055): handed in from the send-lineup screen, then a wait for the
// friend's, asked about every second, until the new match starts (both go into it) or the rematch
// ends without one (out of time), which both players are told, with Home.
import { callApi, type ApiFailure } from '../app/api.ts';
import { decodeRematchView, type RematchView } from '../api/rematch.ts';
import type { Lineup } from '../sim/series.ts';
import type { NoticeContent } from '../ui/notice-content.ts';

/** How often the wait for the friend's lineup asks. */
const ASK_MS = 1_000;

export interface RematchLineupHost {
  /** Shows a notice in the lineup's place; `focus` false keeps focus where it is. */
  show(content: NoticeContent, focus: boolean): void;
  intoSeries(id: string): Promise<void>;
  home(): void;
  /** A failure, as the challenge screens show one (with Try again). */
  failed(answer: ApiFailure, retry: () => Promise<unknown>): void;
}

export interface RematchLineup {
  /** Hands in `lineup` for the rematch of series `id`. */
  submit(id: string, lineup: Lineup): Promise<void>;
  /** The screen went away: stop asking. */
  stop(): void;
}

/** What the wait, or the end of a rematch, says. */
function noticeOf(view: RematchView | undefined, home: () => void): NoticeContent {
  if (view?.state === 'agreed') {
    return {
      title: 'Rematch',
      waiting: {
        title: 'Waiting for your friend’s lineup',
        line: 'The match starts when it’s in.',
      },
      body: [],
      buttons: [],
      quiet: {
        text: 'Home',
        onClick: () => {
          home();
        },
      },
    };
  }
  return {
    title: 'No rematch',
    body: [
      view?.state === 'declined'
        ? 'Your friend said no to a rematch.'
        : 'Time ran out for a rematch.',
    ],
    buttons: [
      {
        text: 'Home',
        onClick: () => {
          home();
        },
      },
    ],
  };
}

export function createRematchLineup(host: RematchLineupHost): RematchLineup {
  let timer: number | undefined;
  let waiting: string | undefined;

  function stop(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    waiting = undefined;
  }

  /** Moves on from an answer: into the match, a wait that asks again, or the end. */
  async function take(id: string, view: RematchView | undefined, focus: boolean): Promise<void> {
    if (view?.state === 'started' && view.seriesId !== null) {
      stop();
      await host.intoSeries(view.seriesId);
      return;
    }
    host.show(
      noticeOf(view, () => {
        host.home();
      }),
      focus,
    );
    if (view?.state !== 'agreed') {
      stop();
      return;
    }
    waiting = id;
    timer = window.setTimeout(() => void ask(id), ASK_MS);
  }

  async function ask(id: string): Promise<void> {
    const answer = await callApi<unknown>('GET', `series/${id}/rematch`);
    if (waiting !== id) return;
    const view = answer.ok ? decodeRematchView(answer.body) : undefined;
    // A failed ask keeps waiting: the next may answer.
    if (view === undefined) timer = window.setTimeout(() => void ask(id), ASK_MS);
    else await take(id, view, false);
  }

  async function submit(id: string, lineup: Lineup): Promise<void> {
    stop();
    const sent = await callApi<unknown>('POST', `series/${id}/rematch`, { lineup });
    if (!sent.ok) {
      if (sent.kind === 'error' && sent.code === 'rematch_closed') {
        await take(id, undefined, true);
        return;
      }
      host.failed(sent, () => submit(id, lineup));
      return;
    }
    await take(id, decodeRematchView(sent.body), true);
  }

  return { submit, stop };
}
