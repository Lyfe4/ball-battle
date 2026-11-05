// Best-of-3 wiring (ADR 0017, 0019): the lineup builder with its draft format, the scoreboard, the
// series session, the bot's choices and when the link may show the bot's lineup. main.ts owns the
// arena and the frame loop and hands this module what it needs through `SeriesHost`, so it stays
// wiring only.
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
  formatOf,
  matchWorld,
  remainingOf,
  setupWithPicks,
  type Format,
  type Lineup,
  type SeriesSetup,
} from './sim/series.ts';
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
  showBuilder(lineup: Lineup | undefined, format?: Format): void;
  /** Starts a series. `fromLink` shows the full link at once and replays its picks. */
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
  /** A replayed link's picks, used in order when a pick is due (both sides'). */
  let linkPicks: readonly string[] = [];
  /** Reveal, then order: the series seed and the bot's lineup while the player orders theirs. */
  let revealed: { readonly seed: number; readonly bot: Lineup } | undefined;

  const builder = createLineupBuilder(roots.lineup, balls, {
    onStart: (lineup, format) => {
      // The bot picks from the series seed, so the setup (and the link) fully decides the series.
      const seed = generateSeed();
      const bot = randomBot.pickLineup(seed, ballIds);
      if (format === 'reveal') {
        revealed = { seed, bot };
        builder.showOrdering(lineup, bot);
        return;
      }
      start({ seed, a: lineup, b: bot, ...(format === 'blind' ? {} : { format }) });
    },
    onLockOrder: (lineup) => {
      if (revealed === undefined) return;
      const { seed, bot } = revealed;
      revealed = undefined;
      start({ seed, a: lineup, b: randomBot.orderLineup(seed, bot, lineup), format: 'reveal' });
    },
    onFormat: (format) => {
      host.replaceUrl((url) => {
        writeSeriesModeParams(url, format);
      });
    },
  });

  const panel = createSeriesPanel(roots.series, lookup, {
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
      showBuilder(last?.a, last === undefined ? undefined : formatOf(last));
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
   * The builder, with the quick match playing on behind it. The URL only says the mode and format,
   * so it never shows a lineup before a series is decided.
   */
  function showBuilder(lineup: Lineup | undefined, format?: Format): void {
    revealed = undefined;
    builder.show(lineup, format);
    host.layoutChanged();
    host.replaceUrl((url) => {
      writeSeriesModeParams(url, builder.format());
    });
    host.redraw();
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
      else writeSeriesModeParams(url, setup.format);
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
