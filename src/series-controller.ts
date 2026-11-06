// Playing a best-of-3 series (ADR 0017, 0019): the scoreboard, the series session, the bot's picks
// and when the link may show the bot's lineup. Setting a series up is series-setup.ts. main.ts owns
// the arena and the frame loop and hands this module what it needs through `SeriesHost`, so it
// stays wiring only. A Back from the series holds it rather than dropping it (ADR 0025): it can be
// resumed where it was, with every choice already made kept, until a new series replaces it.
import { generateSeed } from './app/seed.ts';
import {
  advanceSession,
  beginSession,
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
import { randomBot } from './sim/bot.ts';
import { awaitingPick, type SeriesSetup, type SeriesState } from './sim/series.ts';
import { matchWorld } from './sim/series-verify.ts';
import type { DefinitionLookup, WorldState } from './sim/types.ts';
import { createSeriesPanel, type SeriesPanelRoots, type SeriesPhase } from './ui/series-panel.ts';

/** What the series needs from the page around it. */
export interface SeriesHost {
  /** Puts a new match on screen. */
  showWorld(world: WorldState, seed: number): void;
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
  /** Leaves the series for its setup. */
  leave(): void;
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
   * picks; `firstPick` is the player's round-1 answer in reveal, made on the setup screen.
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

  const panel = createSeriesPanel(roots, lookup, {
    onNext: () => {
      if (session === undefined) return;
      session = resolvePicks(advanceSession(session), randomBot);
      playCurrent();
      host.redraw();
    },
    onPick: (ball) => {
      if (session === undefined || awaitingPick(session.state) !== 'a') return;
      // In reveal the bot answers the ball just shown; resolvePicks makes its pick.
      session = resolvePicks(pickInSession(session, ball), randomBot);
      playCurrent();
      host.redraw();
    },
    onRematch: () => {
      if (session !== undefined) start(rematchOf(session.state.setup, generateSeed()));
    },
    onNewSeries: () => {
      const last = session?.state.setup;
      session = undefined;
      onScreen = false;
      if (last !== undefined) host.newSeries(last);
    },
    onLeave: () => {
      host.leave();
    },
  });

  /** Plays the series' current match: both balls are revealed as it starts. */
  function playCurrent(): void {
    const current = session?.current;
    if (current === undefined) return;
    host.showWorld(matchWorld(current, lookup), current.seed);
    shownAt = host.worldsShown();
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
    let started = resolvePicks(beginSession(setup, fromLink), randomBot);
    if (firstPick !== undefined && awaitingPick(started.state) === 'a') {
      started = resolvePicks(pickInSession(started, firstPick), randomBot);
    }
    session = started;
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
      // The arena showed something else meanwhile: the round starts again from its seed, so it
      // plays out exactly as it would have. A round already recorded stays recorded.
      if (!ours() && !session.recorded) playCurrent();
      host.redraw();
    },
    hold() {
      onScreen = false;
      // A decided series has nothing left to resume.
      if (session?.state.winner !== undefined) session = undefined;
    },
    setVisible(visible) {
      panel.setVisible(visible && onScreen && session !== undefined);
    },
    start,
    settle(world) {
      // Only the series' own match, on screen, is recorded: never a quick match played meanwhile.
      if (session === undefined || !onScreen || !ours()) return;
      const before = session;
      session = showBotBallNow(settleCurrent(session, world), randomBot);
      // Decided: now the link can show both lineups and every pick.
      if (session !== before && session.state.winner !== undefined) writeAddress(session);
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
