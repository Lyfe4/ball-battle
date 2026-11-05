// Best-of-3 wiring (ADR 0017): the lineup builder, the scoreboard, the series session and when the
// link may show the bot's lineup. main.ts owns the arena and the frame loop and hands this module
// what it needs through `SeriesHost`, so it stays wiring only.
import { generateSeed } from './app/seed.ts';
import {
  advanceSession,
  beginSession,
  settleCurrent,
  type SeriesSession,
} from './app/series-session.ts';
import { writeSeriesModeParams, writeSeriesParams } from './app/series-url.ts';
import { randomBot } from './sim/bot.ts';
import { matchWorld, type Lineup, type SeriesSetup } from './sim/series.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from './sim/types.ts';
import { createLineupBuilder } from './ui/lineup-builder.ts';
import { createSeriesPanel } from './ui/series-panel.ts';

/** What the series needs from the page around it. */
export interface SeriesHost {
  /** Puts a new match on screen. */
  showWorld(world: WorldState, seed: number): void;
  replaceUrl(write: (params: URLSearchParams) => void): void;
  /** Which controls show has changed (a series started or ended). */
  layoutChanged(): void;
  /** Redraws the match already on screen. */
  redraw(): void;
}

export interface SeriesController {
  /** True while a series is being played (not while building a lineup). */
  isPlaying(): boolean;
  /** True while the lineup dialog is open (the game pauses meanwhile). */
  isOpen(): boolean;
  /** Shows the builder or the scoreboard in best-of-3 mode, neither in quick mode. */
  setVisible(seriesMode: boolean): void;
  /** Best-of-3 mode before a series: the builder, optionally prefilled. */
  showBuilder(lineup: Lineup | undefined): void;
  /** Starts a series. `fromLink` shows the full link at once (it is a replay). */
  start(setup: SeriesSetup, fromLink?: boolean): void;
  /** Drops the series being played, e.g. on switching to quick mode. */
  leave(): void;
  /** Records the match on screen once it has finished; safe to call every frame. */
  settle(world: WorldState): void;
  /** Updates the scoreboard; cheap enough for every frame. */
  update(world: WorldState, resultShown: boolean): void;
}

export function createSeriesController(
  roots: { readonly lineup: HTMLElement; readonly series: HTMLElement },
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: SeriesHost,
): SeriesController {
  const ballIds = balls.map((ball) => ball.id);
  /** The series being played; undefined while building a lineup and in quick mode. */
  let session: SeriesSession | undefined;

  const builder = createLineupBuilder(roots.lineup, balls, (lineup) => {
    // The bot picks from the series seed, so the setup (and the link) fully decides the series.
    const seed = generateSeed();
    start({ seed, a: lineup, b: randomBot.pickLineup(seed, ballIds) });
  });

  const panel = createSeriesPanel(roots.series, lookup, {
    onNext: () => {
      if (session === undefined) return;
      session = advanceSession(session);
      playCurrent();
    },
    onRematch: () => {
      if (session !== undefined) start({ ...session.state.setup, seed: generateSeed() });
    },
    onNewSeries: () => {
      const last = session?.state.setup.a;
      session = undefined;
      showBuilder(last);
    },
  });

  /** Plays the series' current match: both balls are revealed as it starts. */
  function playCurrent(): void {
    const current = session?.current;
    if (current !== undefined) host.showWorld(matchWorld(current, lookup), current.seed);
  }

  /**
   * The builder, with the quick match playing on behind it. The URL only says the mode, so it
   * never shows a lineup before a series is decided.
   */
  function showBuilder(lineup: Lineup | undefined): void {
    if (lineup !== undefined) builder.show(lineup);
    host.layoutChanged();
    host.replaceUrl(writeSeriesModeParams);
    host.redraw();
  }

  /**
   * The link (both lineups and the seed) is written once the series is decided, so the address
   * bar never gives the bot's lineup away; a series opened from a link already shows it.
   */
  function start(setup: SeriesSetup, fromLink = false): void {
    session = beginSession(setup);
    host.replaceUrl((url) => {
      if (fromLink) writeSeriesParams(url, setup);
      else writeSeriesModeParams(url);
    });
    host.layoutChanged();
    playCurrent();
  }

  return {
    isPlaying: () => session !== undefined,
    isOpen: () => builder.isOpen(),
    setVisible(seriesMode) {
      builder.setVisible(seriesMode && session === undefined);
      panel.setVisible(seriesMode && session !== undefined);
    },
    showBuilder,
    start,
    leave() {
      session = undefined;
    },
    settle(world) {
      if (session === undefined) return;
      const before = session;
      session = settleCurrent(session, world);
      // Decided: now the link can show both lineups.
      const { setup, winner } = session.state;
      if (session !== before && winner !== undefined) {
        host.replaceUrl((url) => {
          writeSeriesParams(url, setup);
        });
      }
    },
    update(world, resultShown) {
      if (session === undefined) return;
      const settled = world.match.status === 'finished' && resultShown;
      panel.update({ state: session.state, current: session.current, settled });
    },
  };
}
