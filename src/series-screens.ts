// Best of 3's two halves wired to the page: setting a series up (series-setup.ts) and playing it
// (series-controller.ts), with their moves between screens. main.ts hands over what they need.
import { writeSeriesModeParams } from './app/series-url.ts';
import type { Navigation } from './app/navigation.ts';
import type { BallInfoLink } from './ui/balls/ball-info.ts';
import { createSeriesController, type SeriesController } from './series-controller.ts';
import { createSeriesSetup, type SeriesSetupFlow } from './series-setup.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from './sim/types.ts';

export interface SeriesScreensHost {
  readonly navigation: Navigation;
  showWorld(world: WorldState, seed: number): void;
  /** Shows whatever screen the URL now names. */
  showCurrentRoute(): void;
  /** A series started (the screen is now the series being played). */
  started(): void;
  layoutChanged(): void;
  /** Home in place of this entry: the first step's Back, arriving from a link. */
  exitToHome(): void;
  readonly ballLink: BallInfoLink;
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
    push: (write) => {
      navigation.push(write);
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
    ballLink: host.ballLink,
    start: (series, firstPick) => {
      navigation.push((url) => {
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
    replaceUrl: (write) => {
      navigation.replace(write);
    },
    layoutChanged: () => {
      host.layoutChanged();
    },
    newSeries: (last) => {
      setup.keep(last);
      navigation.push((url) => {
        writeSeriesModeParams(url, last.format, 'lineup');
      });
      host.showCurrentRoute();
    },
    leave: () => {
      navigation.back(() => {
        navigation.replace((url) => {
          writeSeriesModeParams(url, undefined, 'lineup');
        });
        host.showCurrentRoute();
      });
    },
  });

  return { setup, play };
}
