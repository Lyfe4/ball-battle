// A live match on the page (ADR 0053): the server's clock as this page knows it, and the arena kept
// at the server's moment. Each round fights at the time the server set, on both screens: held on
// its ready card ("Get ready", then the 3-2-1, each line changed by a timer set for its exact
// moment, ADR 0054), then started by a timer set for that exact moment of the corrected clock (not
// a check every so often). A page that learned of the round too late for the whole 3-2-1 says
// "Get ready" until its Fight!. A page that comes back from the background, or
// opens the match late, fights the attempt that is on from the point it has reached; rounds that
// ended meanwhile count as watched. Polling is the heartbeat, and how a move of the other player's
// arrives: every second while waiting on one, else every 2 s (live-ask.ts).
import type { SeriesView } from '../api/series.ts';
import { dueOf } from '../app/online-series.ts';
import type { Side } from '../sim/series.ts';
import type { OnlinePlayHost } from './online-play-types.ts';
import { liveAskMs } from '../app/live-ask.ts';
import {
  asksInFull,
  NO_CLOCK,
  serverNowOf,
  warmUpAskMs,
  withSample,
  type ClockSample,
} from '../app/live-clock.ts';
import {
  catchUpRate,
  countdownLine,
  livePlace,
  nextLineChange,
  type AttemptSlot,
  type LivePlace,
} from '../app/live-play.ts';
import { matchWorld, playToEnd } from '../sim/series-verify.ts';
import type { NextMatch } from '../sim/series.ts';
import type { DefinitionLookup, WorldState } from '../sim/types.ts';

/** How often a page waiting on the other side of a series by turns asks whether it moved. */
const TURNS_POLL_MS = 15_000;
/** How often the pick timers on screen are redrawn (display only: no fight starts on it). */
const DISPLAY_MS = 250;

export interface LiveArena {
  /** Puts `world` on the arena held on its ready moment, with a countdown in place of Fight!. */
  hold(world: WorldState, seed: number): void;
  /** Puts `world` on the arena already `elapsedMs` under way. */
  showAt(world: WorldState, seed: number, elapsedMs: number): void;
  /** Starts the held match, if it is still this series' on screen. */
  release(): void;
  countdown(text: string | undefined): void;
  /** Draws again: the lines under the series count down. */
  redraw(): void;
}

export interface LiveDriver {
  /** An answer's clock sample: the offset estimate gets better. */
  heard(sample: ClockSample | undefined): void;
  /** The server's time now, as this page knows it. */
  now(): number;
  /**
   * Ms until a live page asks about `view` again, its last read having taken `readMs`: four times a
   * second until the clock rests on a few answers (ADR 0061), then as live-ask.ts says.
   */
  askEvery(view: SeriesView, readMs: number, poked?: boolean): number;
  /** The next read must come back in full: only that tells this page the server's time. */
  asksInFull(): boolean;
  /** Where `view` is now for a page that has watched `watched` rounds. */
  place(view: SeriesView, watched: number): LivePlace;
  /**
   * Shows `match`, the attempt `slot` times, unless the arena already shows it (`showing`):
   * held until its start, or from where it has got to. Its start is a timer for that moment.
   */
  stage(slot: AttemptSlot, match: NextMatch, showing: boolean): void;
  /** The attempt staged, while there is one. */
  staged(): AttemptSlot | undefined;
  /** A staged attempt is under way now: the arena's own frames draw it. */
  fighting(): boolean;
  /**
   * The staged fight's playback rate, the arena having played `playedMs` of it: 1 before its start,
   * then gently faster or slower until it is at the server's moment (ADR 0063).
   */
  rate(playedMs: number): number;
  /** Nothing to stage (a pick phase, the end): any countdown and start timer stop. */
  clear(): void;
  /**
   * Starts or stops the display ticker (the countdowns) with the screen. It redraws only while no
   * fight plays: during one the arena draws every frame, and nothing else runs on the side.
   */
  setActive(active: boolean, onTick: () => void): void;
}

export function createLiveDriver(lookup: DefinitionLookup, arena: LiveArena): LiveDriver {
  let clock = NO_CLOCK;
  let slot: AttemptSlot | undefined;
  let start: number | undefined;
  /** When this page learned of the staged attempt, by the server's clock. */
  let learnedAt = 0;
  /** The countdown line's next change. */
  let line: number | undefined;
  let ticker: number | undefined;
  let onTick: () => void = () => undefined;
  /** Each played round's attempts in ticks, by series and round: played headlessly once. */
  const lengths = new Map<string, readonly number[]>();
  const now = () => serverNowOf(clock, Date.now());

  function ticksOf(view: SeriesView, round: number): readonly number[] {
    const key = `${view.id}:${String(round)}`;
    const known = lengths.get(key);
    if (known !== undefined) return known;
    const record = view.rounds[round];
    const ticks =
      record?.seeds.map(
        (seed, attempt) =>
          playToEnd(matchWorld({ round, attempt, seed, a: record.a, b: record.b }, lookup), lookup)
            .tick,
      ) ?? [];
    lengths.set(key, ticks);
    return ticks;
  }

  function stopLine(): void {
    if (line !== undefined) window.clearTimeout(line);
    line = undefined;
  }

  /** Shows the countdown's line now and sets a timer for the moment it next changes. */
  function countdown(): void {
    stopLine();
    const at = now();
    if (slot === undefined || at >= slot.startAt) {
      arena.countdown(undefined);
      return;
    }
    arena.countdown(countdownLine(slot.startAt, at, learnedAt));
    const next = nextLineChange(slot.startAt, at);
    if (next !== undefined) line = window.setTimeout(countdown, Math.max(1, next));
  }

  function stopStart(): void {
    if (start !== undefined) window.clearTimeout(start);
    start = undefined;
  }

  return {
    heard(sample) {
      if (sample !== undefined) clock = withSample(clock, sample);
    },
    now,
    askEvery: (view, readMs, poked) => warmUpAskMs(clock) ?? liveAskMs(view, now(), readMs, poked),
    asksInFull: () => asksInFull(clock, Date.now()),
    place: (view, watched) => livePlace(view, watched, now(), (round) => ticksOf(view, round)),
    stage(next, match, showing) {
      const same = slot?.round === next.round && slot.attempt === next.attempt;
      if (!same) learnedAt = now();
      slot = next;
      const world = matchWorld(match, lookup);
      const until = next.startAt - now();
      if (!showing || !same) {
        if (until > 0) arena.hold(world, match.seed);
        else arena.showAt(world, match.seed, -until);
      }
      stopStart();
      if (until > 0) {
        // The fight starts at its server time: one timer, set for that moment.
        start = window.setTimeout(() => {
          start = undefined;
          arena.countdown(undefined);
          arena.release();
        }, until);
      }
      countdown();
    },
    staged: () => slot,
    fighting: () => slot !== undefined && now() >= slot.startAt && now() < slot.endAt,
    rate(playedMs) {
      const at = now();
      return slot === undefined || at < slot.startAt
        ? 1
        : catchUpRate(at - slot.startAt - playedMs);
    },
    clear() {
      slot = undefined;
      stopStart();
      stopLine();
      arena.countdown(undefined);
    },
    setActive(active, tick) {
      onTick = tick;
      if (!active) {
        if (ticker !== undefined) window.clearInterval(ticker);
        ticker = undefined;
        stopStart();
        stopLine();
        return;
      }
      // Already ticking: kept as it is, so a render doesn't move its beat.
      if (ticker !== undefined) return;
      ticker = window.setInterval(() => {
        onTick();
      }, DISPLAY_MS);
    },
  };
}

/**
 * The live arena of the series screen: what the page's host does, `ours` saying whether the arena
 * still shows this series' play (only then does a start timer start it), `shown` noting each play
 * put on it.
 */
export function liveArenaOf(
  host: Pick<OnlinePlayHost, 'holdLive' | 'showLiveAt' | 'release' | 'countdown' | 'redraw'>,
  ours: () => boolean,
  shown: () => void,
): LiveArena {
  return {
    hold: (world, seed) => {
      host.holdLive(world, seed);
      shown();
    },
    showAt: (world, seed, ms) => {
      host.showLiveAt(world, seed, ms);
      shown();
    },
    release: () => {
      if (ours()) host.release();
    },
    countdown: (text) => {
      host.countdown(text);
    },
    redraw: () => {
      host.redraw();
    },
  };
}

/**
 * When to ask about a series again, in ms: live, `liveEvery(view)` while open (the live driver's
 * `askEvery`); by turns, now and then while waiting on the other side.
 */
export function nextAskOf(
  view: SeriesView,
  live: boolean,
  liveEvery: (view: SeriesView) => number,
): number | undefined {
  if (view.status !== 'open') return undefined;
  if (live) return liveEvery(view);
  return dueOf(view).includes(view.you) ? undefined : TURNS_POLL_MS;
}

/** Who must pick now: in a live series, nobody before it starts or while a fight is still on. */
export function dueAt(view: SeriesView, now: number): readonly Side[] {
  const clock = view.live;
  if (clock == null) return dueOf(view);
  if (clock.startedAt === null || clock.opensAt === null || now < clock.opensAt) return [];
  return dueOf(view);
}
