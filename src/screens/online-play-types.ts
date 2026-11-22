// The online series screen's parts as the page sees them (ADR 0052, 0053): what it needs from the
// arena and the page, and what it offers back.
import type { ApiResult } from '../app/api.ts';
import type { SeriesView } from '../api/series.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import type { WorldState } from '../sim/types.ts';
import type { SeriesPhase } from '../ui/series-panel.ts';

export interface OnlinePlayHost {
  showWorld(world: WorldState, seed: number): void;
  /** A live round held on its countdown, or already `elapsedMs` under way (ADR 0053). */
  holdLive(world: WorldState, seed: number): void;
  showLiveAt(world: WorldState, seed: number, elapsedMs: number): void;
  /** Starts the held match at its server time. */
  release(): void;
  countdown(text: string | undefined): void;
  worldsShown(): number;
  layoutChanged(): void;
  redraw(): void;
  /** Home, the way on from a series that waits on the other side or has ended. */
  home(): void;
  readonly storage: DeviceStorage;
  /** The series read just before moving here, shown at once (online-prime.ts, ADR 0054). */
  readonly primed?: (id: string) => ApiResult<unknown> | undefined;
  /** Moves by the Back rules (a rematch's lineup, ADR 0055). */
  go(write: (params: URLSearchParams) => void): void;
  /** Reads series `id` so its screen shows complete on arrival (ADR 0054). */
  primeSeries(id: string): Promise<void>;
  /** A live series ended on this device: a rematch of it reaches the player anywhere. */
  readonly ended?: (view: SeriesView) => void;
}

export interface OnlinePlay {
  /** Opens the series `id` (a route). */
  open(id: string): void;
  /** Leaving its screen: stop asking the server (a rematch is then asked about from anywhere). */
  leave(): void;
  phase(): SeriesPhase | undefined;
  /** True while a round is on the arena, being fought or just fought. */
  isPlaying(): boolean;
  /**
   * The arena holds one of this series' rounds. Until then (its lineups, picks and coin toss before
   * round 1) the arena behind it shows nothing, never what was on it before (the home demo).
   */
  roundOnArena(): boolean;
  /** A live match is on screen: its fights play at 1× (ADR 0053). */
  isLive(): boolean;
  /** The ended live series whose end screen shows now, which offers its own rematch. */
  endScreen(): string | undefined;
  /** The series on screen, if this screen shows: a rematch's new match once it started. */
  seriesShown(): string | undefined;
  /**
   * A live fight's playback rate, the arena having played `playedMs` of it: 1, or a little off 1
   * while it catches up with the server's moment (ADR 0063).
   */
  liveRate(playedMs: number): number;
  /** The line under a live fight, where the speed toggle would be. */
  footLine(): string | undefined;
  setVisible(visible: boolean): void;
  /** The health bars' labels, slot A's first: "You" on the player's side, the other's name. */
  sides(): readonly string[] | undefined;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
}
