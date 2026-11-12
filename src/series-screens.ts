// Best of 3's two halves wired to the page: setting a series up (series-setup.ts) and playing it
// (series-controller.ts), with their moves between screens. main.ts hands over what they need. A
// series saved before a reload is taken back here, held until the route shows it (ADR 0042).
import { clearSeries, loadSeries, saveSeries, type SaveStorage } from './app/series-save.ts';
import type { ScreenHandler } from './app/router.ts';
import { seriesRound } from './app/screen-rules.ts';
import { writeSeriesModeParams } from './app/series-url.ts';
import type { Navigation } from './app/navigation.ts';
import { createSeriesController, type SeriesController } from './series-controller.ts';
import { createSeriesSetup, type SeriesSetupFlow } from './series-setup.ts';
import type { SeriesPanelRoots } from './ui/series-panel.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from './sim/types.ts';

export interface SeriesScreensHost {
  readonly navigation: Navigation;
  /** Moves to the screen `write` describes, by the Back rules (ADR 0025), and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** Shows another screen in place of this entry (a Back fallback). */
  replaceWith(write: (params: URLSearchParams) => void): void;
  showWorld(world: WorldState, seed: number): void;
  /** Puts a finished match on screen as it ended (a round's result, after a reload). */
  showFinished(world: WorldState, seed: number): void;
  /** Where the series is kept across a reload (ADR 0042). */
  readonly storage: SaveStorage;
  /** Counts every world put on the arena (the series checks its match is still there). */
  worldsShown(): number;
  /** A series started (the screen is now the series being played). */
  started(): void;
  layoutChanged(): void;
  /** Draws the arena's frame again (which updates the scoreboard). */
  redraw(): void;
  /** Home in place of this entry: the first step's Back, arriving from a link. */
  exitToHome(): void;
  /** Other modes in place of this entry: a lineup's Back, arriving from a link (ADR 0046). */
  exitToModes(): void;
}

export interface SeriesScreens {
  readonly setup: SeriesSetupFlow;
  readonly play: SeriesController;
  /** The router's handler for a series URL: a setup step, or a round. */
  readonly screen: ScreenHandler<'series'>;
  /** Carries on with the held series: its own entry again (the setup's and home's Resume). */
  resume(): void;
}

export function createSeriesScreens(
  roots: { readonly setup: HTMLElement; readonly play: SeriesPanelRoots },
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: SeriesScreensHost,
): SeriesScreens {
  const { navigation } = host;
  const setup = createSeriesSetup(roots.setup, balls, {
    move: (write) => {
      navigation.go(write);
    },
    replace: (write) => {
      navigation.replace(write);
    },
    back: (toParent) => {
      navigation.back(toParent);
    },
    exit: () => {
      host.exitToHome();
    },
    toModes: () => {
      host.exitToModes();
    },
    held: () => play.held(),
    resume: () => {
      resume();
    },
    start: (series, firstPick) => {
      // From the round-1 answer this replaces it: the series is one entry, so Back can't reopen
      // the answer (ADR 0025).
      navigation.go((url) => {
        writeSeriesModeParams(url, series.format, 'play', series.bestOf);
      });
      play.start(series, false, firstPick);
      // After the start, so the arena is on screen to take focus.
      host.started();
    },
  });

  const play = createSeriesController(roots.play, lookup, {
    showWorld: (world, seed) => {
      host.showWorld(world, seed);
    },
    showFinished: (world, seed) => {
      host.showFinished(world, seed);
    },
    save: (session) => {
      if (session === undefined) clearSeries(host.storage);
      else saveSeries(host.storage, session);
    },
    worldsShown: () => host.worldsShown(),
    replaceUrl: (write) => {
      navigation.replace(write);
    },
    layoutChanged: () => {
      host.layoutChanged();
    },
    redraw: () => {
      host.redraw();
    },
    newSeries: (last) => {
      setup.keep(last);
      // Back to the lineup this series came from, when it did (ADR 0025).
      host.go((url) => {
        writeSeriesModeParams(url, last.format, 'lineup', last.bestOf);
      });
    },
    leave: (left) => {
      navigation.back(() => {
        host.replaceWith((url) => {
          writeSeriesModeParams(url, left?.format, 'lineup', left?.bestOf);
        });
      });
    },
  });

  // A reload: the series as it was, held as a Back would have left it, so the route carries on with
  // it (a round's URL) or offers it back (Resume on the rules and the lineup).
  const saved = loadSeries(host.storage, lookup);
  if (saved !== undefined) play.adopt(saved);

  const screen: ScreenHandler<'series'> = {
    show: (route) => {
      if (route.step !== 'play') {
        // Back (or Leave) keeps an undecided series to resume, with every choice made.
        play.hold();
        host.layoutChanged();
        setup.show(route.step, route.link);
        return;
      }
      const round = seriesRound(route.link, { has: play.hasSeries(), address: play.address() });
      if (round === 'carry on') {
        play.resume();
      } else if (round === 'lineup') {
        host.replaceWith((url) => {
          writeSeriesModeParams(url, route.link.format, 'lineup', route.link.bestOf);
        });
      } else {
        play.start(round.replay, true);
      }
    },
    leave: () => {
      play.hold();
    },
  };

  /** The series' own entry again; the route carries on with the held series. */
  function resume(): void {
    host.go((url) => {
      const held = play.held()?.setup;
      writeSeriesModeParams(url, held?.format, 'play', held?.bestOf);
    });
  }

  return { setup, play, screen, resume };
}
