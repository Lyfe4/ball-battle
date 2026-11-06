// Best of 3's two halves wired to the page: setting a series up (series-setup.ts) and playing it
// (series-controller.ts), with their moves between screens. main.ts hands over what they need.
import { writeSeriesModeParams } from './app/series-url.ts';
import type { Navigation } from './app/navigation.ts';
import { createSeriesController, type SeriesController } from './series-controller.ts';
import { createSeriesSetup, type SeriesSetupFlow } from './series-setup.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from './sim/types.ts';

export interface SeriesScreensHost {
  readonly navigation: Navigation;
  /** Moves to the screen `write` describes, by the Back rules (ADR 0025), and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** Shows another screen in place of this entry (a Back fallback). */
  replaceWith(write: (params: URLSearchParams) => void): void;
  showWorld(world: WorldState, seed: number): void;
  /** Counts every world put on the arena (the series checks its match is still there). */
  worldsShown(): number;
  /** A series started (the screen is now the series being played). */
  started(): void;
  layoutChanged(): void;
  /** Draws the arena's frame again (which updates the scoreboard). */
  redraw(): void;
  /** Home in place of this entry: the first step's Back, arriving from a link. */
  exitToHome(): void;
}

export interface SeriesScreens {
  readonly setup: SeriesSetupFlow;
  readonly play: SeriesController;
}

export function createSeriesScreens(
  roots: { readonly setup: HTMLElement; readonly play: HTMLElement },
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
    held: () => play.held(),
    resume: () => {
      // The series' own entry again; the route carries on with the held series.
      host.go((url) => {
        writeSeriesModeParams(url, play.held()?.setup.format, 'play');
      });
    },
    start: (series, firstPick) => {
      // From the round-1 answer this replaces it: the series is one entry, so Back can't reopen
      // the answer (ADR 0025).
      navigation.go((url) => {
        writeSeriesModeParams(url, series.format, 'play');
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
        writeSeriesModeParams(url, last.format, 'lineup');
      });
    },
    leave: () => {
      navigation.back(() => {
        host.replaceWith((url) => {
          writeSeriesModeParams(url, undefined, 'lineup');
        });
      });
    },
  });

  return { setup, play };
}
