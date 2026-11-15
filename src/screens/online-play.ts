// Playing an online series (ADR 0052) on the series screens. The server holds the series; this page
// shows its view. Every round this device hasn't watched is fought again on the arena from its
// revealed seed, so the player watches what was played since their last visit and the page checks
// the server's result as it goes. A pick goes to the server; while it is the other side's turn the
// page asks again now and then (a 304 when nothing moved). At the end, the fair-play check.
import { callApi, failureKindOf } from '../app/api.ts';
import { rememberWatched, watchedOf, type DeviceStorage } from '../app/online-device.ts';
import { dueOf, fairPlayOf, seatsOf, stateAt, type FairPlay } from '../app/online-series.ts';
import { advanceSession, settleCurrent, type SeriesSession } from '../app/series-session.ts';
import type { SeriesView } from '../api/series.ts';
import { decodeSeriesView } from '../api/series-view-decode.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { nextMatch, type NextMatch } from '../sim/series.ts';
import { matchWorld } from '../sim/series-verify.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';
import { createNotice } from '../ui/notice.ts';
import { createSeriesPanel, type SeriesPanelRoots, type SeriesPhase } from '../ui/series-panel.ts';
import { createFairPlayLine } from '../ui/series/fair-play.ts';
import { onlineNotice, waitNote, type LoadStatus } from './online-text.ts';
import { createLiveDriver, LIVE_POLL_MS, liveLog, liveNote } from './online-live.ts';

/** How often a page waiting on the other side asks whether the series moved. */
const POLL_MS = 15_000;

export interface OnlinePlayHost {
  showWorld(world: WorldState, seed: number): void;
  worldsShown(): number;
  layoutChanged(): void;
  redraw(): void;
  /** Home, the way on from a series that waits on the other side or has ended. */
  home(): void;
  readonly storage: DeviceStorage;
}

export interface OnlinePlay {
  /** Opens the series `id` (a route). */
  open(id: string): void;
  /** Leaving its screen: stop asking the server. */
  leave(): void;
  phase(): SeriesPhase | undefined;
  /** True while a round is on the arena, being fought or just fought. */
  isPlaying(): boolean;
  setVisible(visible: boolean): void;
  /** The health bars' labels, slot A's first: "You" on the player's side, the other's name. */
  sides(): readonly string[] | undefined;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
}

export function createOnlinePlay(
  roots: SeriesPanelRoots & { readonly notice: HTMLElement },
  lookup: DefinitionLookup,
  host: OnlinePlayHost,
): OnlinePlay {
  let id: string | undefined;
  let view: SeriesView | undefined;
  let session: SeriesSession | undefined;
  let watched = 0;
  let status: LoadStatus = 'loading';
  /** The server's message for a refusal shown as the status. */
  let reason: string | undefined;
  let visible = false;
  let shownAt = -1;
  /** Which play the arena was given (round, attempt, seed): only that one is ever recorded. */
  let shownPlay = '';
  let phase: SeriesPhase = 'between';
  let fair: FairPlay | 'checking' | undefined;
  let timer: number | undefined;
  const sent = new Set<number>();
  let autoUntil = 0;
  let etag: string | null = null;
  let ticker: number | undefined;
  const keyOf = (play: NextMatch | undefined) =>
    play === undefined ? '' : `${String(play.round)}:${String(play.attempt)}:${String(play.seed)}`;
  /**
   * The arena still shows the play this series last put on it, and that play is the current one:
   * after a round is recorded the next one is current while the last one's ending is still on
   * screen, and that ending must never be recorded as the next round's.
   */
  const ours = () => host.worldsShown() === shownAt && keyOf(session?.current) === shownPlay;

  const panel = createSeriesPanel(
    roots,
    lookup,
    {
      onNext: () => {
        if (session === undefined) return;
        session = session.state.pending.length > 0 ? advanceSession(session) : sessionAt(watched);
        playCurrent();
        host.redraw();
      },
      onPick: (ball) => {
        void pick(ball);
      },
      onRematch: () => undefined,
      onNewSeries: () => {
        host.home();
      },
      onLeave: () => {
        host.home();
      },
    },
    true,
  );
  const live = createLiveDriver({
    view: () => view,
    current: () =>
      session?.current === undefined
        ? undefined
        : { ...session.current, key: keyOf(session.current), recorded: session.recorded },
    shown: () => ({ key: shownPlay, ours: ours() }),
    play: playCurrent,
    next: () => {
      if (session === undefined) return;
      session = session.state.pending.length > 0 ? advanceSession(session) : sessionAt(watched);
    },
    redraw: () => {
      host.redraw();
    },
  });
  const fairLine = createFairPlayLine();
  roots.panel.append(fairLine.element);
  const notice = createNotice(roots.notice, () => {
    host.home();
  });

  /** The session at `seen` rounds watched: the next one to watch on the arena, if any. */
  function sessionAt(seen: number): SeriesSession | undefined {
    if (view === undefined) return undefined;
    const state = stateAt(view, seen);
    const current = seen < view.rounds.length ? nextMatch(state) : undefined;
    return { state, current, recorded: false, replay: undefined };
  }

  function playCurrent(): void {
    const current = session?.current;
    if (current === undefined) return;
    host.showWorld(matchWorld(current, lookup), current.seed);
    shownAt = host.worldsShown();
    shownPlay = keyOf(current);
  }

  function setStatus(next: LoadStatus, message?: string): void {
    status = next;
    reason = message;
    render();
  }

  /** Takes a new view: the rounds watched stay watched; anything new waits for Play round. */
  function adopt(next: SeriesView): void {
    const first = view?.id !== next.id;
    if (!first && live.adopted(view, next, sent)) autoUntil = Date.now() + 6_000;
    view = next;
    // A series under another ruleset than this page's (a bump mid-series) can't be fought again
    // here: the server plays it on its own frozen sim, and this page shows its rounds on the track.
    const replayable = next.ruleset === RULESET_VERSION;
    watched = replayable
      ? Math.min(watchedOf(host.storage, next.id), next.rounds.length)
      : next.rounds.length;
    if (first || session?.current === undefined || session.recorded) session = sessionAt(watched);
    status = 'ready';
    if (next.status !== 'open' && watched === next.rounds.length && fair === undefined) {
      fair = 'checking';
      void fairPlayOf(next, lookup).then((result) => {
        fair = result;
        if (result === 'unfair') console.error(`Series ${next.id}: the fair-play check failed`);
        render();
      });
    }
    render();
    // After a pick as after a read: if the other side is to move now, ask again later.
    schedule();
  }

  async function load(): Promise<void> {
    if (id === undefined) return;
    const headers: Record<string, string> =
      view?.id === id && etag !== null ? { 'If-None-Match': etag } : {};
    const answer = await live.timed(() =>
      callApi<unknown>('GET', `series/${id ?? ''}`, undefined, headers),
    );
    if (answer.ok && answer.etag !== null) etag = answer.etag;
    if (answer.ok) {
      const decoded = answer.status === 304 ? view : decodeSeriesView(answer.body);
      if (decoded === undefined) setStatus('error');
      else adopt(decoded);
    } else if (answer.kind === 'error' && (answer.status === 404 || answer.status === 401)) {
      setStatus('missing');
    } else if (answer.kind === 'error') {
      setStatus(failureKindOf(answer), answer.message);
    } else if (view === undefined) {
      // Offline or too slow with nothing to show yet; with a series on screen, the next poll asks.
      setStatus(answer.kind);
    }
    schedule();
  }

  async function pick(ball: string): Promise<void> {
    if (view === undefined || id === undefined) return;
    const round = view.rounds.length;
    sent.add(round);
    const at = Date.now();
    const answer = await callApi<unknown>('POST', `series/${id}/picks`, { round, ball });
    liveLog().picks.push({ round, ball, sent: at, answered: Date.now() });
    if (answer.ok) {
      const decoded = decodeSeriesView(answer.body);
      if (decoded !== undefined) adopt(decoded);
      return;
    }
    // Refused (a stale tab): the series as the server has it now. Offline, too slow or failing: say
    // so; Try again reads the series, which shows whether the pick went through.
    if (answer.kind === 'error' && answer.status < 500) await load();
    else setStatus(failureKindOf(answer));
  }

  /** Asks again later while the other side is to move and nobody watches a round here. */
  function schedule(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    const waiting =
      visible && view?.status === 'open' && !dueOf(view).includes(view.you) && status === 'ready';
    // PROTOTYPE (live): a live page always asks, every second: its heartbeat.
    const livePoll = visible && view?.live !== undefined && view.status === 'open';
    if (waiting || livePoll) {
      timer = window.setTimeout(() => void load(), livePoll ? LIVE_POLL_MS : POLL_MS);
    }
  }

  function render(): void {
    const ready = status === 'ready' && view !== undefined;
    roots.notice.hidden = !visible || ready;
    if (!ready && visible)
      notice.show(
        onlineNotice(
          status,
          () => {
            setStatus('loading');
            void load();
          },
          () => {
            host.home();
          },
          reason,
        ),
        false,
      );
    panel.setVisible(visible && ready);
    host.layoutChanged();
    host.redraw();
  }

  return {
    open(next) {
      if (id !== next) {
        id = next;
        view = undefined;
        session = undefined;
        fair = undefined;
        status = 'loading';
      }
      visible = true;
      ticker ??= window.setInterval(() => {
        live.tick();
      }, 200);
      render();
      // Back on a round that was being fought: it starts again from its seed (as offline).
      const current = session?.current;
      if (current !== undefined && keyOf(current) === shownPlay && !ours()) playCurrent();
      void load();
    },
    leave() {
      visible = false;
      window.clearInterval(ticker);
      ticker = undefined;
      schedule();
      render();
    },
    phase: () => (visible && status === 'ready' && view !== undefined ? phase : undefined),
    // The series on screen (as offline): the arena shows behind it, and makes way between rounds.
    isPlaying: () => visible && status === 'ready' && view !== undefined,
    sides() {
      if (view === undefined) return undefined;
      const { them } = seatsOf(view);
      return view.you === 'a' ? ['You', them] : [them, 'You'];
    },
    setVisible(next) {
      panel.setVisible(next && visible && status === 'ready');
      roots.notice.hidden = !(next && visible && status !== 'ready');
    },
    settle(world) {
      if (session === undefined || view === undefined || !visible || !ours()) return;
      const settled = settleCurrent(session, world);
      if (settled === session) return;
      session = settled;
      const played = settled.state.rounds.length;
      if (played > watched) {
        const record = settled.state.rounds[played - 1];
        const server = view.rounds[played - 1];
        // The server's result stands; a replay that disagrees is a determinism bug to hear about.
        if (JSON.stringify(record) !== JSON.stringify(server)) {
          console.error(
            `Series ${view.id} round ${String(played)}: the replay disagreed`,
            JSON.stringify(record),
            JSON.stringify(server),
          );
        }
        watched = played;
        rememberWatched(host.storage, view.id, watched);
        adopt(view);
      }
    },
    update(world, celebrated) {
      if (session === undefined || view === undefined || !visible || status !== 'ready') return;
      const settled = ours() ? world.match.status === 'finished' && celebrated : true;
      live.celebrated(celebrated);
      const all = watched === view.rounds.length;
      const shown = panel.update({
        state: session.state,
        current: session.current,
        settled: session.current === undefined || settled,
        linkState: undefined,
        seats: seatsOf(view),
        due: all ? dueOf(view) : [],
        online: {
          note:
            view.live !== undefined && view.status === 'open'
              ? liveNote(view, live.clock.now(), watched, Date.now() < autoUntil)
              : all
                ? waitNote(view, Date.now())
                : undefined,
        },
      });
      fairLine.show(all && shown === 'finished' ? fair : undefined);
      if (shown !== phase) {
        phase = shown;
        host.layoutChanged();
        if (phase !== 'playing') panel.focusAction();
        schedule();
      }
    },
  };
}
