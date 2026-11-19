// What the stage knows of the series on screen, offline (series-play.ts) or online
// (online-play.ts): whether one is on screen and being played, so a setup screen is up otherwise,
// and whether the arena holds one of its rounds yet (ADR 0073 fix: never the home demo behind it).
import type { Screen } from '../app/route.ts';
import { isSetupScreen } from '../app/screen-rules.ts';

interface SeriesOnArena {
  roundOnArena(): boolean;
}

export interface SeriesStage {
  /** A series screen is up, offline or online. */
  readonly onScreen: () => boolean;
  /** The series on screen is being played. */
  readonly playing: () => boolean;
  /** A setup screen is up (choosing balls, or setting up a series): no match is being watched. */
  readonly isSetup: () => boolean;
  /**
   * Marks the stage `data-no-round` while the series on screen has none of its rounds on the arena
   * (a live match's lineups, picks and coin toss before round 1): the arena then shows nothing,
   * never the world it last held, such as the home demo dimmed beside the panel.
   */
  readonly markRoundOnArena: () => void;
  /**
   * Marks the stage `data-round-over` between rounds and at the end (the round screen takes the
   * arena's place, ADR 0025), and `data-no-round` as above.
   */
  readonly markRound: (roundOver: boolean) => void;
}

export function createSeriesStage(
  stage: { toggleAttribute(name: string, force?: boolean): boolean },
  current: () => Screen,
  online: SeriesOnArena & { playing(): boolean },
  offline: SeriesOnArena & { isPlaying(): boolean },
): SeriesStage {
  const onScreen = () => current() === 'series' || current() === 'online';
  const playing = () => (current() === 'online' ? online.playing() : offline.isPlaying());
  const roundOnArena = () => (current() === 'online' ? online : offline).roundOnArena();
  const markRoundOnArena = () => {
    stage.toggleAttribute('data-no-round', onScreen() && playing() && !roundOnArena());
  };
  return {
    onScreen,
    playing,
    isSetup: () => isSetupScreen(current(), playing()),
    markRoundOnArena,
    markRound: (roundOver) => {
      stage.toggleAttribute('data-round-over', roundOver);
      markRoundOnArena();
    },
  };
}
