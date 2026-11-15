// Playing an online series (ADR 0052) on the series screens. The server holds the series; this page
// shows its view. By turns, every round this device hasn't watched is fought again on the arena from
// its revealed seed when the player presses Play round. Live (ADR 0053), each round is fought at the
// server's time on both screens (online-live.ts), and the page asks every second, which is its
// heartbeat. Requests are online-series-client.ts's; at the end, the fair-play check.
import { rememberWatched, watchedOf } from '../app/online-device.ts';
import {
  fairPlayOf,
  reportReplay,
  seatsOf,
  stateAt,
  stateAtAttempt,
  type FairPlay,
} from '../app/online-series.ts';
import { advanceSession, settleCurrent, type SeriesSession } from '../app/series-session.ts';
import type { SeriesView } from '../api/series.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { nextMatch, type NextMatch } from '../sim/series.ts';
import { matchWorld } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createNotice } from '../ui/notice.ts';
import { createSeriesPanel, type SeriesPanelRoots, type SeriesPhase } from '../ui/series-panel.ts';
import { createFairPlayLine } from '../ui/series/fair-play.ts';
import { liveFootLine, liveNote } from './live-text.ts';
import { createLiveDriver, dueAt, liveArenaOf, nextAskOf } from './online-live.ts';
import { createSeriesClient } from './online-series-client.ts';
import { onlineNotice, waitNote, type LoadStatus } from './online-text.ts';
import type { OnlinePlay, OnlinePlayHost } from './online-play-types.ts';

export type { OnlinePlay, OnlinePlayHost } from './online-play-types.ts';

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
  /** A live page whose last read failed: it says so, and keeps asking. */
  let reconnecting = false;
  const keyOf = (play: NextMatch | undefined) =>
    play === undefined ? '' : `${String(play.round)}:${String(play.attempt)}:${String(play.seed)}`;
  /**
   * The arena still shows the play this series last put on it, and that play is the current one:
   * after a round is recorded the next one is current while the last one's ending is still on
   * screen, and that ending must never be recorded as the next round's.
   */
  const ours = () => host.worldsShown() === shownAt && keyOf(session?.current) === shownPlay;
  /** A live series this page can fight (its own ruleset); otherwise it is shown as by turns. */
  const isLive = () => view?.live != null && view.ruleset === RULESET_VERSION;
  const shown = () => {
    shownAt = host.worldsShown();
    shownPlay = keyOf(session?.current);
  };

  const live = createLiveDriver(
    lookup,
    liveArenaOf(host, () => visible && ours(), shown),
  );

  const client = createSeriesClient({
    view: () => view,
    adopt,
    heard: (sample) => {
      live.heard(sample);
    },
    missing: () => {
      setStatus('missing');
    },
    failed: (kind, message) => {
      setStatus(kind, message);
    },
    dropped: () => {
      // Live with a match on screen: it plays on from the server's times; the line says so.
      reconnecting = view !== undefined && isLive();
      return reconnecting;
    },
    nextAsk: () =>
      visible && view !== undefined && status === 'ready' ? nextAskOf(view, isLive()) : undefined,
  });

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
        void client.pick(ball);
      },
      onRematch: () => undefined,
      onNewSeries: () => {
        host.home();
      },
      // Live: Leave and forfeit, asked first by the panel. By turns: Home.
      onLeave: () => {
        void client.forfeit().then(() => {
          host.home();
        });
      },
    },
    true,
  );
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
    shown();
  }

  function setStatus(next: LoadStatus, message?: string): void {
    status = next;
    reason = message;
    render();
  }

  function setWatched(seen: number): void {
    if (view === undefined || seen === watched) return;
    watched = seen;
    rememberWatched(host.storage, view.id, watched);
  }

  /** Once every round has been watched, the fair-play check (once per series). */
  function checkFairPlay(): void {
    if (view === undefined || view.status === 'open' || watched !== view.rounds.length) return;
    if (fair !== undefined) return;
    const checked = view;
    fair = 'checking';
    void fairPlayOf(checked, lookup).then((result) => {
      fair = result;
      if (result === 'unfair') console.error(`Series ${checked.id}: the fair-play check failed`);
      render();
    });
  }

  /**
   * A live series at the server's moment: rounds whose fights have ended count as watched, and the
   * attempt on now (or next) is on the arena, held to its start or from where it has got to.
   * `restage` puts it back at the server's moment even if it is already showing (a return).
   */
  function placeLive(restage: boolean): void {
    if (view === undefined) return;
    const placed = live.place(view, watched);
    setWatched(placed.watched);
    const slot = placed.slot;
    if (slot === undefined) {
      live.clear();
      // Nothing to fight: the series as it stands (a new pick, or the end).
      session = sessionAt(watched);
    } else {
      const was = keyOf(session?.current);
      const state = stateAtAttempt(view, watched, slot.attempt);
      session = { state, current: nextMatch(state), recorded: false, replay: undefined };
      const current = session.current;
      const showing = !restage && was === keyOf(current) && host.worldsShown() === shownAt;
      if (current !== undefined) live.stage(slot, current, showing);
    }
    checkFairPlay();
  }

  /** Takes a new view: by turns the rounds watched stay watched and anything new waits. */
  function adopt(next: SeriesView): void {
    const first = view?.id !== next.id;
    view = next;
    // A series under another ruleset than this page's (a bump mid-series) can't be fought again
    // here: the server plays it on its own frozen sim, and this page shows its rounds on the track.
    const replayable = next.ruleset === RULESET_VERSION;
    watched = replayable
      ? Math.min(watchedOf(host.storage, next.id), next.rounds.length)
      : next.rounds.length;
    status = 'ready';
    reconnecting = false;
    if (isLive()) placeLive(first);
    else if (first || session?.current === undefined || session.recorded) {
      session = sessionAt(watched);
    }
    checkFairPlay();
    render();
    client.schedule();
  }

  function render(): void {
    const ready = status === 'ready' && view !== undefined;
    roots.notice.hidden = !visible || ready;
    const retry = () => {
      setStatus('loading');
      void client.load();
    };
    if (!ready && visible) {
      notice.show(
        onlineNotice(
          status,
          retry,
          () => {
            host.home();
          },
          reason,
        ),
        false,
      );
    }
    panel.setVisible(visible && ready);
    live.setActive(visible && ready && isLive(), () => {
      const slot = live.staged();
      if (slot !== undefined && live.now() >= slot.endAt) placeLive(false);
      host.redraw();
    });
    host.layoutChanged();
    host.redraw();
  }

  // Back from the background (iPhone Safari pauses a hidden page): ask now, and put the fight
  // back at the server's moment, since the arena paused where it was.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !visible || !isLive()) return;
    placeLive(true);
    void client.load();
  });

  /** Who must pick now: nobody before a live match starts or while its fight is still on. */
  return {
    open(next) {
      if (id !== next) {
        id = next;
        view = undefined;
        session = undefined;
        fair = undefined;
        status = 'loading';
        client.open(next);
      }
      visible = true;
      render();
      // Back on a round that was being fought: it starts again from its seed (as offline); live,
      // from where the server's clock says it is.
      if (isLive()) placeLive(true);
      else {
        const current = session?.current;
        if (current !== undefined && keyOf(current) === shownPlay && !ours()) playCurrent();
      }
      void client.load();
    },
    leave() {
      visible = false;
      client.schedule();
      render();
    },
    phase: () => (visible && status === 'ready' && view !== undefined ? phase : undefined),
    // The series on screen (as offline): the arena shows behind it, and makes way between rounds.
    isPlaying: () => visible && status === 'ready' && view !== undefined,
    isLive: () => visible && isLive(),
    footLine: () =>
      visible && view !== undefined && isLive()
        ? liveFootLine(view, live.now(), reconnecting)
        : undefined,
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
      if (session === undefined || view === undefined || !visible || !ours() || isLive()) return;
      const settled = settleCurrent(session, world);
      if (settled === session) return;
      session = settled;
      const played = settled.state.rounds.length;
      if (played > watched) {
        reportReplay(view, settled.state.rounds[played - 1], played);
        setWatched(played);
        adopt(view);
      }
    },
    update(world, celebrated) {
      if (session === undefined || view === undefined || !visible || status !== 'ready') return;
      const now = live.now();
      const slot = live.staged();
      // Live: a fight is over at its server end time, on both screens, not at its knockout.
      if (isLive() && slot !== undefined && now >= slot.endAt) placeLive(false);
      const settled = isLive()
        ? live.staged() === undefined
        : ours()
          ? world.match.status === 'finished' && celebrated
          : true;
      const all = watched === view.rounds.length;
      const note = isLive() ? liveNote(view, now, watched) : waitNote(view, Date.now());
      const next = panel.update({
        state: session.state,
        current: session.current,
        settled: session.current === undefined || settled,
        linkState: undefined,
        seats: seatsOf(view),
        due: all ? dueAt(view, live.now()) : [],
        online: { note: all ? note : undefined, live: isLive() },
      });
      fairLine.show(all && next === 'finished' ? fair : undefined);
      if (next !== phase) {
        phase = next;
        host.layoutChanged();
        if (phase !== 'playing') panel.focusAction();
        client.schedule();
      }
    },
  };
}
