// Decisions the screens make when a route opens them, as pure functions so they are tested without
// a DOM: what the page shows that more than one screen reads, whether Back carries on with a match,
// and what a series round's URL can still do after a reload.
import type { PlaybackSpeed } from './speed.ts';
import { DEFAULT_MATCHUP, type Matchup } from './matchup.ts';
import type { Route, Screen } from './route.ts';
import type { RouteOf } from './router.ts';

/**
 * What more than one screen reads, in one object owned by main.ts: the quick match last chosen or
 * played, the seed of the world on screen, and the playback speed.
 */
export interface AppState {
  matchup: Matchup;
  seed: number;
  speed: PlaybackSpeed;
}

/** The state a page opens with: the link's matchup and seed where it names them. */
export function initialAppState(
  route: Route,
  speed: PlaybackSpeed,
  newSeed: () => number,
): AppState {
  return {
    matchup: 'matchup' in route ? route.matchup : DEFAULT_MATCHUP,
    seed: (route.screen === 'match' ? route.seed : undefined) ?? newSeed(),
    speed,
  };
}

/**
 * Back from the quick-match setup to the match it covered carries on with that match rather than
 * restarting it: same balls, same seed, coming from the setup.
 */
export function resumesMatch(route: RouteOf<'match'>, from: Screen, state: AppState): boolean {
  const same = route.matchup.a === state.matchup.a && route.matchup.b === state.matchup.b;
  return from === 'pick' && same && route.seed === state.seed;
}

/**
 * What a series round's URL does: replay the series a link holds, carry on with the series being
 * played, or (Forward into a series the player left, or a reload mid-series: the bot's lineup was
 * never in the URL) set up again from the lineup.
 */
export function seriesRound(link: RouteOf<'series'>['link'], playing: boolean) {
  if (link.setup !== undefined) return { replay: link.setup } as const;
  return playing ? ('carry on' as const) : ('lineup' as const);
}
