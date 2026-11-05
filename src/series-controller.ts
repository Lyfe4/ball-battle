// Playing a best-of-3 series (ADR 0017, 0019): the scoreboard, the series session, the bot's picks
// and when the link may show the bot's lineup. Setting a series up is series-setup.ts. main.ts owns
// the arena and the frame loop and hands this module what it needs through `SeriesHost`, so it
// stays wiring only.
import { generateSeed } from './app/seed.ts';
import {
  advanceSession,
  beginSession,
  pickInSession,
  rematchOf,
  replayPickDue,
  resolvePicks,
  seriesAddress,
  settleCurrent,
  type SeriesSession,
} from './app/series-session.ts';
import { writeSeriesModeParams, writeSeriesParams } from './app/series-url.ts';
import { randomBot } from './sim/bot.ts';
import { awaitingPick, type SeriesSetup } from './sim/series.ts';
import { matchWorld } from './sim/series-verify.ts';
import type { DefinitionLookup, WorldState } from './sim/types.ts';
import { createSeriesPanel } from './ui/series-panel.ts';

/** What the series needs from the page around it. */
export interface SeriesHost {
  /** Puts a new match on screen. */
  showWorld(world: WorldState, seed: number): void;
  replaceUrl(write: (params: URLSearchParams) => void): void;
  /** Which controls show has changed (a series started or ended). */
  layoutChanged(): void;
  /** After a series: set up the next one, with this one's lineup and format kept. */
  newSeries(last: SeriesSetup): void;
  /** Leaves the series for its setup. */
  leave(): void;
}

export interface SeriesController {
  /** True while a series is being played. */
  isPlaying(): boolean;
  /** Shows or hides the scoreboard. */
  setVisible(visible: boolean): void;
  /**
   * Starts a series. `fromLink` shows the full link at once and replays its picks; `firstPick` is
   * the player's round-1 answer in reveal, made on the setup screen.
   */
  start(setup: SeriesSetup, fromLink?: boolean, firstPick?: string): void;
  /** Drops the series being played (the player left it). */
  leave(): void;
  /** Records the match on screen once it has finished; safe to call every frame. */
  settle(world: WorldState): void;
  /** Updates the scoreboard; cheap enough for every frame. */
  update(world: WorldState, resultShown: boolean): void;
}

export function createSeriesController(
  root: HTMLElement,
  lookup: DefinitionLookup,
  host: SeriesHost,
): SeriesController {
  /** The series being played; undefined when none is. */
  let session: SeriesSession | undefined;

  const panel = createSeriesPanel(root, lookup, {
    onNext: () => {
      if (session === undefined) return;
      session = resolvePicks(advanceSession(session), randomBot);
      playCurrent();
    },
    onPick: (ball) => {
      if (session === undefined || awaitingPick(session.state) !== 'a') return;
      // In reveal the bot answers the ball just shown; resolvePicks makes its pick.
      session = resolvePicks(pickInSession(session, ball), randomBot);
      playCurrent();
    },
    onRematch: () => {
      if (session !== undefined) start(rematchOf(session.state.setup, generateSeed()));
    },
    onNewSeries: () => {
      const last = session?.state.setup;
      session = undefined;
      if (last !== undefined) host.newSeries(last);
    },
    onLeave: () => {
      host.leave();
    },
  });

  /** Plays the series' current match: both balls are revealed as it starts. */
  function playCurrent(): void {
    const current = session?.current;
    if (current !== undefined) host.showWorld(matchWorld(current, lookup), current.seed);
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
    writeAddress(started);
    host.layoutChanged();
    playCurrent();
  }

  return {
    isPlaying: () => session !== undefined,
    setVisible(visible) {
      panel.setVisible(visible && session !== undefined);
    },
    start,
    leave() {
      session = undefined;
    },
    settle(world) {
      if (session === undefined) return;
      const before = session;
      session = settleCurrent(session, world);
      // Decided: now the link can show both lineups and every pick.
      if (session !== before && session.state.winner !== undefined) writeAddress(session);
    },
    update(world, resultShown) {
      if (session === undefined) return;
      const settled = world.match.status === 'finished' && resultShown;
      const linkPickDue = replayPickDue(session) !== undefined;
      panel.update({ state: session.state, current: session.current, settled, linkPickDue });
    },
  };
}
