// Playing a best-of-3 series (ADR 0017, 0019): the scoreboard, the series session, the bot's picks
// and when the link may show the bot's lineup. Setting a series up is series-setup.ts. main.ts owns
// the arena and the frame loop and hands this module what it needs through `SeriesHost`, so it
// stays wiring only. A Back from the series holds it rather than dropping it (ADR 0025): it can be
// resumed where it was, with every choice already made kept, until a new series replaces it. Every
// change is saved on the device (ADR 0042), so a reload puts the series back where it was; leaving
// it on purpose (Leave series, New series) forgets it.
import { generateSeed } from './app/seed.ts';
import {
  advanceSession,
  beginSession,
  botOf,
  pickInSession,
  rematchOf,
  resolvePicks,
  seriesAddress,
  settleCurrent,
  showBotBallNow,
  withLinkPicks,
  type SeriesSession,
} from './app/series-session.ts';
import { writeSeriesModeParams, writeSeriesParams } from './app/series-url.ts';
import { awaitingPick, type Format, type SeriesSetup, type SeriesState } from './sim/series.ts';
import { matchWorld, playToEnd } from './sim/series-verify.ts';
import type { DefinitionLookup, WorldState } from './sim/types.ts';
import { createSeriesPanel, type SeriesPanelRoots, type SeriesPhase } from './ui/series-panel.ts';
import { lastPlayOf } from './ui/series/series-view.ts';

/** What the series needs from the page around it. */
export interface SeriesHost {
  /** Puts a new match on screen. */
  showWorld(world: WorldState, seed: number): void;
  /** Puts a finished match on screen as it ended, with no intro and no Fight! to wait on. */
  showFinished(world: WorldState, seed: number): void;
  /** Keeps the series on the device, so a reload puts it back (ADR 0042); undefined forgets it. */
  save(session: SeriesSession | undefined): void;
  /** Counts every world put on the arena, by anyone: whether the one there is still the series'. */
  worldsShown(): number;
  replaceUrl(write: (params: URLSearchParams) => void): void;
  /** Which controls show has changed (a series started or ended). */
  layoutChanged(): void;
  /**
   * Draws the arena's frame again, which updates the scoreboard. The scoreboard updates from the
   * arena's frames, and the arena stops drawing once a finished match is still, so a change that
   * puts no new match on the arena (a Reveal series opening on a pick) must ask for one.
   */
  redraw(): void;
  /** After a series: set up the next one, with this one's lineup and format kept. */
  newSeries(last: SeriesSetup): void;
  /** Leaves the series for its setup, in the series' format. */
  leave(format: Format | undefined): void;
}

export interface SeriesController {
  /** True while a series is on screen being played. */
  isPlaying(): boolean;
  /** True while there is a series to play or carry on with: on screen, or held after a Back. */
  hasSeries(): boolean;
  /**
   * An undecided series the player left (a Back, perhaps by accident): where it stands, for the
   * setup screens' Resume card. Undefined when there is none.
   */
  held(): SeriesState | undefined;
  /** Puts a held series back on screen where it was; every choice made stays made. */
  resume(): void;
  /**
   * Takes back a series saved before a reload (ADR 0042), held until the route puts it on screen,
   * as a Back would have left it.
   */
  adopt(saved: SeriesSession): void;
  /**
   * The whole series the address bar shows for the series in hand, once it shows one: a decided
   * series or a replayed link. A link to it carries on with it rather than replaying it.
   */
  address(): SeriesSetup | undefined;
  /** Leaves the series' screen but keeps it, undecided, so it can be resumed. */
  hold(): void;
  /**
   * Where the series on screen is: a round being fought, between rounds, or decided. Undefined
   * when none is on screen. Between rounds and at the end the arena makes way (ADR 0025).
   */
  phase(): SeriesPhase | undefined;
  /** Shows or hides the scoreboard. */
  setVisible(visible: boolean): void;
  /**
   * Starts a series, replacing any held one. `fromLink` shows the full link at once and replays its
   * picks; `firstPick` is the player's round-1 pick in Reveal or Showdown, made on the setup screen.
   */
  start(setup: SeriesSetup, fromLink?: boolean, firstPick?: string): void;
  /** Records the match on screen once it has finished; safe to call every frame. */
  settle(world: WorldState): void;
  /**
   * Updates the scoreboard; cheap enough for every frame. `celebrated` is true once the round's
   * result and its Winner sticker have played: only then does the round screen take over.
   */
  update(world: WorldState, celebrated: boolean): void;
}

export function createSeriesController(
  roots: SeriesPanelRoots,
  lookup: DefinitionLookup,
  host: SeriesHost,
): SeriesController {
  /** The series being played or held; undefined when none is. */
  let session: SeriesSession | undefined;
  /** Whether the series is on screen (not held behind a setup screen). */
  let onScreen = false;
  /** What `host.worldsShown()` was when the series last put its match on the arena. */
  let shownAt = -1;
  /** True while the arena still holds the series' match. */
  const ours = () => host.worldsShown() === shownAt;
  let phase: SeriesPhase = 'playing';

  /** Sets the series in hand and saves it, so a reload finds it as it is now. */
  function keep(next: SeriesSession | undefined): void {
    session = next;
    host.save(next);
  }

  const panel = createSeriesPanel(roots, lookup, {
    onNext: () => {
      if (session === undefined) return;
      keep(resolvePicks(advanceSession(session), botOf(session.state.setup)));
      playCurrent();
      host.redraw();
    },
    onPick: (ball) => {
      if (session === undefined || awaitingPick(session.state) !== 'a') return;
      // The bot answers the ball just shown (or opens a Showdown); resolvePicks makes its pick.
      keep(resolvePicks(pickInSession(session, ball), botOf(session.state.setup)));
      playCurrent();
      host.redraw();
    },
    onRematch: () => {
      if (session !== undefined) start(rematchOf(session.state.setup, generateSeed()));
    },
    onNewSeries: () => {
      const last = session?.state.setup;
      keep(undefined);
      onScreen = false;
      if (last !== undefined) host.newSeries(last);
    },
    onLeave: () => {
      // Leaving on purpose forgets the series: there is nothing to resume (ADR 0042). A Back,
      // which can be an accident, holds it instead.
      const format = session?.state.setup.format;
      keep(undefined);
      host.leave(format);
    },
  });

  /** Plays the series' current match: both balls are revealed as it starts. */
  function playCurrent(): void {
    const current = session?.current;
    if (current === undefined) return;
    host.showWorld(matchWorld(current, lookup), current.seed);
    shownAt = host.worldsShown();
  }

  /**
   * The series' match as the arena should show it after something else was there: the match to
   * fight from its Fight! moment, or the play whose result is on screen as it ended.
   */
  function showAgain(): void {
    if (session === undefined) return;
    if (!session.recorded) {
      playCurrent();
      return;
    }
    const last = lastPlayOf(session.state);
    if (last === undefined) return;
    host.showFinished(playToEnd(matchWorld(last, lookup), lookup), last.seed);
  }

  /** Writes what the address bar may show of the series now (seriesAddress). */
  function writeAddress(playing: SeriesSession): void {
    const address = seriesAddress(playing);
    host.replaceUrl((url) => {
      if ('setup' in address) writeSeriesParams(url, address.setup);
      else writeSeriesModeParams(url, address.format, 'play');
    });
  }

  function start(setup: SeriesSetup, fromLink = false, firstPick?: string): void {
    const bot = botOf(setup);
    let started = resolvePicks(beginSession(setup, fromLink), bot);
    if (firstPick !== undefined && awaitingPick(started.state) === 'a') {
      started = resolvePicks(pickInSession(started, firstPick), bot);
    }
    keep(started);
    onScreen = true;
    phase = 'playing';
    writeAddress(started);
    host.layoutChanged();
    playCurrent();
    // A Reveal series can open on a pick, with no match to show: the screen must still change.
    host.redraw();
  }

  return {
    isPlaying: () => onScreen && session !== undefined,
    phase: () => (onScreen && session !== undefined ? phase : undefined),
    hasSeries: () => session !== undefined,
    held: () =>
      session !== undefined && !onScreen && session.state.winner === undefined
        ? session.state
        : undefined,
    resume() {
      if (session === undefined) return;
      onScreen = true;
      writeAddress(session);
      host.layoutChanged();
      // The arena showed something else meanwhile (or the page was reloaded): the round starts
      // again from its seed, so it plays out exactly as it would have. A round already recorded
      // stays recorded, its finished match behind the round screen.
      if (!ours()) showAgain();
      host.redraw();
    },
    adopt(saved) {
      session = saved;
      onScreen = false;
      shownAt = -1;
    },
    address() {
      if (session === undefined) return undefined;
      const address = seriesAddress(session);
      return 'setup' in address ? address.setup : undefined;
    },
    hold() {
      onScreen = false;
      // A decided series has nothing left to resume.
      if (session?.state.winner !== undefined) keep(undefined);
    },
    setVisible(visible) {
      panel.setVisible(visible && onScreen && session !== undefined);
    },
    start,
    settle(world) {
      // Only the series' own match, on screen, is recorded: never a quick match played meanwhile.
      if (session === undefined || !onScreen || !ours()) return;
      const before = session;
      const settled = showBotBallNow(settleCurrent(session, world), botOf(session.state.setup));
      if (settled === before) return;
      keep(settled);
      // Decided: now the link can show both lineups and every pick.
      if (settled.state.winner !== undefined) writeAddress(settled);
    },
    update(world, celebrated) {
      if (session === undefined || !onScreen) return;
      const settled = ours() ? world.match.status === 'finished' && celebrated : session.recorded;
      const shown = panel.update({
        state: session.state,
        current: session.current,
        settled,
        linkState: withLinkPicks(session),
      });
      if (shown === phase) return;
      phase = shown;
      host.layoutChanged();
      // The round is over: focus moves to what the player does next.
      if (phase !== 'playing') panel.focusAction();
    },
  };
}
