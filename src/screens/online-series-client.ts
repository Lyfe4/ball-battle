// An online series' requests (ADR 0052, 0053): reading it (with its ETag, so a series that hasn't
// moved costs a 304), locking a pick, Leave and forfeit, and asking again on a timer. The screen
// decides what each answer means for what it shows; this module only talks to the server.
import { callApi, failureKindOf, type ApiResult, type FailureKind } from '../app/api.ts';
import type { ClockSample } from '../app/live-clock.ts';
import type { SeriesView } from '../api/series.ts';
import { decodeSeriesView } from '../api/series-view-decode.ts';

export interface SeriesClientHost {
  /** The series on screen, if any (its version is the ETag sent). */
  view(): SeriesView | undefined;
  /** A view from the server, after a read or a pick. */
  adopt(view: SeriesView): void;
  /** An answer's clock sample (a live series). */
  heard(sample: ClockSample | undefined): void;
  /** Not one of this player's series (or gone), or the session is. */
  missing(): void;
  /** A read or pick failed: what failed, and a refusal's message. */
  failed(kind: FailureKind | 'error', message?: string): void;
  /** A read failed while a live match is on screen: it plays on, and says so. */
  dropped(): boolean;
  /** When to ask again, in ms, or undefined for not now; the last read took `readMs`. */
  nextAsk(readMs: number): number | undefined;
  /** Whether a read may be answered with a 304: live, not while the clock needs a full answer. */
  conditional(): boolean;
}

export interface SeriesClient {
  /**
   * The series this screen reads from now on; `primed`, an answer read for it just before moving
   * here (online-prime.ts), is taken at once, as if just read.
   */
  open(id: string, primed?: ApiResult<unknown>): void;
  load(): Promise<void>;
  pick(ball: string): Promise<void>;
  /** Leave and forfeit (a live series still open): the match is lost at once. */
  forfeit(): Promise<void>;
  /** Asks again later, as the host says, or stops asking. */
  schedule(): void;
}

export function createSeriesClient(host: SeriesClientHost): SeriesClient {
  let id: string | undefined;
  let timer: number | undefined;
  /**
   * The ETag of the last full answer, sent back as is: a live series' ETag also says whether the
   * opponent shows as away (ADR 0053), so a version alone would get a 304 when they come back.
   */
  let etag: string | null = null;
  /** How long the last read took, from asking to its answer (0 before the first). */
  let readMs = 0;

  function schedule(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    const delay = host.nextAsk(readMs);
    if (delay !== undefined) timer = window.setTimeout(() => void load(), delay);
  }

  async function load(): Promise<void> {
    if (id === undefined) return;
    const view = host.view();
    const headers: Record<string, string> =
      view?.id === id && etag !== null && host.conditional() ? { 'If-None-Match': etag } : {};
    const sent = performance.now();
    const answer = await callApi<unknown>('GET', `series/${id}`, undefined, headers);
    readMs = performance.now() - sent;
    take(answer);
  }

  /** What a read answered. */
  function take(answer: ApiResult<unknown>): void {
    if (answer.ok) {
      host.heard(answer.clock);
      if (answer.status !== 304) etag = answer.etag;
      const decoded = answer.status === 304 ? host.view() : decodeSeriesView(answer.body);
      if (decoded === undefined) host.failed('error');
      else host.adopt(decoded);
    } else if (answer.kind === 'error' && (answer.status === 404 || answer.status === 401)) {
      host.missing();
    } else if (!host.dropped()) {
      if (answer.kind === 'error') host.failed(failureKindOf(answer), answer.message);
      // Offline or too slow with nothing to show yet; with a series on screen, the next ask asks.
      else if (host.view() === undefined) host.failed(answer.kind);
    }
    schedule();
  }

  return {
    open(next, primed) {
      id = next;
      etag = null;
      if (primed !== undefined) take(primed);
    },
    load,
    async pick(ball) {
      const view = host.view();
      if (view === undefined || id === undefined) return;
      const answer = await callApi<unknown>('POST', `series/${id}/picks`, {
        round: view.rounds.length,
        ball,
      });
      if (answer.ok) {
        host.heard(answer.clock);
        etag = answer.etag;
        const decoded = decodeSeriesView(answer.body);
        if (decoded !== undefined) host.adopt(decoded);
        return;
      }
      // Refused (a stale tab, a pick a moment early): the series as the server has it now.
      // Offline, too slow or failing: say so; Try again reads it, which shows whether it went in.
      if (answer.kind === 'error' && answer.status < 500) await load();
      else host.failed(failureKindOf(answer));
    },
    async forfeit() {
      const view = host.view();
      if (id === undefined || view?.live == null || view.status !== 'open') return;
      await callApi('POST', `series/${id}/forfeit`, {});
    },
    schedule,
  };
}

/** The same series in full: a 304, or an answer that moved nothing (the heartbeat only). */
export const sameView = (view: SeriesView | undefined, next: SeriesView): boolean =>
  view !== undefined &&
  (next === view ||
    (next.version === view.version && JSON.stringify(next) === JSON.stringify(view)));
