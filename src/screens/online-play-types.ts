// The online series screen's parts as the page sees them (ADR 0052, 0053): what it needs from the
// arena and the page, and what it offers back.
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
}

export interface OnlinePlay {
  /** Opens the series `id` (a route). */
  open(id: string): void;
  /** Leaving its screen: stop asking the server. */
  leave(): void;
  phase(): SeriesPhase | undefined;
  /** True while a round is on the arena, being fought or just fought. */
  isPlaying(): boolean;
  /** A live match is on screen: its fights play at 1× (ADR 0053). */
  isLive(): boolean;
  /** The line under a live fight, where the speed toggle would be. */
  footLine(): string | undefined;
  setVisible(visible: boolean): void;
  /** The health bars' labels, slot A's first: "You" on the player's side, the other's name. */
  sides(): readonly string[] | undefined;
  settle(world: WorldState): void;
  update(world: WorldState, celebrated: boolean): void;
}
