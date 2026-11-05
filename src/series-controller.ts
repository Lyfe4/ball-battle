// Playing a best-of-3 series (ADR 0017, 0019): the scoreboard, the series session, the bot's picks
// and when the link may show the bot's lineup. Setting a series up is series-setup.ts. main.ts owns
// the arena and the frame loop and hands this module what it needs through `SeriesHost`, so it
// stays wiring only.
import { generateSeed } from './app/seed.ts';
import {
  advanceSession,
  beginSession,
  pickInSession,
  settleCurrent,
  type SeriesSession,
} from './app/series-session.ts';
import { writeSeriesModeParams, writeSeriesParams } from './app/series-url.ts';
import { botPick, randomBot } from './sim/bot.ts';
import {
  awaitingPick,
  matchWorld,
  remainingOf,
  setupWithPicks,
  type SeriesSetup,
} from './sim/series.ts';
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
  /** Starts a series. `fromLink` shows the full link at once and replays its picks. */
  start(setup: SeriesSetup, fromLink?: boolean): void;
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
  /** A replayed link's picks, used in order when a pick is due (both sides'). */
  let linkPicks: readonly string[] = [];

  const panel = createSeriesPanel(root, lookup, {
    onNext: () => {
      if (session === undefined) return;
      session = resolvePicks(advanceSession(session));
      playCurrent();
    },
    onPick: (ball) => {
      if (session === undefined || awaitingPick(session.state) !== 'a') return;
      session = pickInSession(session, ball);
      playCurrent();
    },
    onRematch: () => {
      if (session === undefined) return;
      const { a, b, format } = session.state.setup;
      start({ seed: generateSeed(), a, b, ...(format === undefined ? {} : { format }) });
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

  /**
   * Makes any pick that doesn't need the player: a replayed link's next pick, or the bot's when it
   * lost. A link pick that isn't legal any more is dropped, and the rest of the series is played.
   */
  function resolvePicks(from: SeriesSession): SeriesSession {
    const due = awaitingPick(from.state);
    if (due === undefined) return from;
    const fromLink = linkPicks[from.state.picks.length];
    if (fromLink !== undefined && remainingOf(from.state, due).includes(fromLink)) {
      return pickInSession(from, fromLink);
    }
    linkPicks = [];
    const bot = botPick(randomBot, from.state);
    return bot === undefined ? from : pickInSession(from, bot);
  }

  /** Plays the series' current match: both balls are revealed as it starts. */
  function playCurrent(): void {
    const current = session?.current;
    if (current !== undefined) host.showWorld(matchWorld(current, lookup), current.seed);
  }

  /**
   * The link (both lineups, the seed, the format and the picks) is written once the series is
   * decided, so the address bar never gives the bot's lineup away; a series opened from a link
   * already shows it.
   */
  function start(setup: SeriesSetup, fromLink = false): void {
    linkPicks = fromLink ? (setup.picks ?? []) : [];
    session = beginSession(setup);
    host.replaceUrl((url) => {
      if (fromLink) writeSeriesParams(url, setup);
      else writeSeriesModeParams(url, setup.format, 'play');
    });
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
      const { winner } = session.state;
      if (session !== before && winner !== undefined) {
        const decided = setupWithPicks(session.state);
        host.replaceUrl((url) => {
          writeSeriesParams(url, decided);
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
