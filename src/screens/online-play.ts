// Playing an online series (ADR 0052) on the series screens. The server holds the series; this page
// shows its view. By turns, every round this device hasn't watched is fought again on the arena from
// its revealed seed when the player presses Play round. Live (ADR 0053), each round is fought at the
// server's time on both screens (online-live.ts), and the page asks every second or two, which is
// its heartbeat (live-ask.ts). Requests are online-series-client.ts's; at the end, the fair-play check.
import { rememberWatched, watchedOf } from '../app/online-device.ts';
import {
  fairPlayOf,
  reportReplay,
  seatsOf,
  sessionOf,
  sidesOf,
  stateAtAttempt,
  type FairPlay,
} from '../app/online-series.ts';
import { advanceSession, settleCurrent, type SeriesSession } from '../app/series-session.ts';
import type { SeriesView } from '../api/series.ts';
import { replaysHere } from '../sim/ruleset.ts';
import { nextMatch, type NextMatch } from '../sim/series.ts';
import { matchWorld } from '../sim/series-verify.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createNotice } from '../ui/notice.ts';
import { createSeriesPanel, type SeriesPanelRoots, type SeriesPhase } from '../ui/series-panel.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { liveFootLine } from './live-text.ts';
import { createLiveDriver, dueAt, liveArenaOf, nextAskOf } from './online-live.ts';
import { createSeriesClient, sameView } from './online-series-client.ts';
import { createLivePoke } from './live-poke.ts';
import { createSeriesExtras } from './online-series-extras.ts';
import { onlineNotice, type LoadStatus } from './online-text.ts';
import type { OnlinePlay, OnlinePlayHost } from './online-play-types.ts';

export type { OnlinePlay, OnlinePlayHost } from './online-play-types.ts';

export function createOnlinePlay(
  roots: SeriesPanelRoots & { readonly notice: HTMLElement; readonly loading: HTMLElement },
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
  const isLive = () => view?.live != null && replaysHere(view.ruleset);
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
    conditional: () => !isLive() || !live.asksInFull(),
    nextAsk: (readMs) => {
      if (!visible || view === undefined || status !== 'ready') return undefined;
      // Live or by turns (ADR 0085): the other's move arrives by poke while the series is open.
      const poked = livePoke.showing(view.status === 'open');
      return nextAskOf(view, isLive(), (shown) => live.askEvery(shown, readMs, poked));
    },
  });
  const livePoke = createLivePoke(client);

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
      // A request: the ball tapped shows it is working, the rest of the grid waits.
      onPick: (ball) => client.pick(ball),
      onRematch: () => extras.rematch.yes(),
      onDecline: () => extras.rematch.no(),
      onNewSeries: () => {
        host.home();
      },
      // Live: Leave and forfeit, asked first by the panel. By turns: Home.
      onLeave: () =>
        client.forfeit().then(() => {
          host.home();
        }),
    },
    true,
  );
  // The pick card, the fair-play line and the rematch (ADR 0055).
  const extras = createSeriesExtras(roots.panel, lookup, host);
  const notice = createNotice(roots.notice, () => {
    host.home();
  });
  // Opened cold (a link, a reload): the pick screen's layout until the first answer (ADR 0054).
  createSkeleton(roots.loading, 'series', () => {
    host.home();
  });

  /** The session at `seen` rounds watched: the next one to watch on the arena, if any. */
  const sessionAt = (seen: number) => (view === undefined ? undefined : sessionOf(view, seen));

  function playCurrent(): void {
    const current = session?.current;
    if (current === undefined) return;
    host.showWorld(matchWorld(current, lookup), current.seed);
    shown();
  }

  function setStatus(next: LoadStatus, message?: string): void {
    [status, reason] = [next, message];
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

  /**
   * Nothing moved (a 304, or the same series in full) on a screen that shows it: the read was the
   * heartbeat and nothing else, so a live fight's frames are left alone. What changes with time
   * alone (a fight's end, a countdown) the display ticker and the arena's frames take care of.
   */
  const unchanged = (next: SeriesView): boolean =>
    status === 'ready' && !reconnecting && sameView(view, next);

  /** Takes a new view: by turns the rounds watched stay watched and anything new waits. */
  function adopt(next: SeriesView): void {
    if (unchanged(next)) {
      client.schedule();
      return;
    }
    const first = view?.id !== next.id;
    view = next;
    // A new series (a rematch, another link): what the arena holds is not one of its rounds.
    if (first) shownAt = -1;
    // A live match that ended here: its rematch reaches the player anywhere (rematch-watch.ts).
    if (next.live != null && next.status !== 'open') host.ended?.(next);
    // A series under another ruleset than this page's (a bump mid-series) can't be fought again
    // here: the server plays it on its own frozen sim, and this page shows its rounds on the track.
    const replayable = replaysHere(next.ruleset);
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
    const loading = status === 'loading';
    roots.loading.hidden = !visible || !loading;
    roots.notice.hidden = !visible || ready || loading;
    // Try again keeps the notice up, its button working, until the answer shows what's next.
    const retry = () => client.load();
    if (visible && status !== 'ready' && status !== 'loading') {
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
      // The countdowns and notes, redrawn while nothing moves on the arena; a fight draws itself.
      if (!live.fighting()) host.redraw();
    });
    host.layoutChanged();
    if (!live.fighting()) host.redraw();
  }

  // Back from the background (iPhone Safari pauses a hidden page): ask now, and put the fight
  // back at the server's moment, since the arena paused where it was.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !visible || !isLive()) return;
    placeLive(true);
    void client.load();
  });

  return {
    open(next) {
      visible = true;
      // Read just before moving here: shown at once, with no read of its own first.
      const primed = id === next ? undefined : host.primed?.(next);
      if (id !== next) {
        id = next;
        view = undefined;
        session = undefined;
        fair = undefined;
        status = 'loading';
        client.open(next, primed);
      }
      render();
      // Back on a round that was being fought: it starts again from its seed (as offline); live,
      // from where the server's clock says it is (a series read just before is placed already).
      if (isLive() && primed === undefined) placeLive(true);
      else {
        const current = session?.current;
        if (current !== undefined && keyOf(current) === shownPlay && !ours()) playCurrent();
      }
      if (primed === undefined) void client.load();
    },
    leave() {
      visible = false;
      extras.rematch.watch(undefined, false);
      client.schedule();
      render();
    },
    phase: () => (visible && status === 'ready' && view !== undefined ? phase : undefined),
    // The series on screen (as offline): the arena shows behind it, and makes way between rounds.
    isPlaying: () => visible && status === 'ready' && view !== undefined,
    roundOnArena: () => host.worldsShown() === shownAt,
    isLive: () => visible && isLive(),
    endScreen: () => (visible ? extras.rematch.watching() : undefined),
    endingTold: (told) => extras.rematch.told(told),
    seriesShown: () => (visible ? id : undefined),
    liveRate: (playedMs) => (visible && isLive() ? live.rate(playedMs) : 1),
    footLine: () =>
      visible && view !== undefined && isLive()
        ? liveFootLine(view, live.now(), reconnecting, watched === 0)
        : undefined,
    sides: () => (view === undefined ? undefined : sidesOf(view)),
    setVisible(next) {
      panel.setVisible(next && visible && status === 'ready');
      roots.loading.hidden = !(next && visible && status === 'loading');
      roots.notice.hidden = !(next && visible && status !== 'ready' && status !== 'loading');
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
      const tick = { view, state: session.state, now, live: isLive(), all, watched, visible };
      const next = panel.update({
        state: session.state,
        current: session.current,
        settled: session.current === undefined || settled,
        linkState: undefined,
        seats: seatsOf(view),
        due: all ? dueAt(view, live.now()) : [],
        online: { ...extras.moment(tick), now: () => live.now() },
      });
      extras.shown(tick, next, fair);
      if (next !== phase) {
        phase = next;
        host.layoutChanged();
        if (phase !== 'playing') panel.focusAction();
        client.schedule();
      }
    },
  };
}
