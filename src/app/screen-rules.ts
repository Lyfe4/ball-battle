// Decisions the screens make when a route opens them, as pure functions so they are tested without
// a DOM: what the page shows that more than one screen reads, whether Back carries on with a match,
// and what a series round's URL can still do after a reload.
import type { PlaybackSpeed } from './speed.ts';
import { DEFAULT_MATCHUP, type Matchup } from './matchup.ts';
import type { Route, Screen } from './route.ts';
import type { RouteOf } from './router.ts';
import type { SeriesSetup } from '../sim/series.ts';
import { sameSeries } from './series-url.ts';

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

/** The series the page has in hand (played, held, or saved before a reload), as a round's URL sees it. */
export interface SeriesInHand {
  /** Whether there is one. */
  readonly has: boolean;
  /** The whole series its address shows, once it shows one (decided, or a replayed link). */
  readonly address: SeriesSetup | undefined;
}

/**
 * What a series round's URL does: carry on with the series in hand (Forward, Resume after a Back,
 * ADR 0025, or a reload, ADR 0042), replay the series a link holds when it is another one, or set
 * up again from the lineup when there is nothing to carry on with (a reload with nothing saved).
 */
export function seriesRound(link: RouteOf<'series'>['link'], inHand: SeriesInHand) {
  if (link.setup !== undefined) {
    const same = inHand.address !== undefined && sameSeries(inHand.address, link.setup);
    return same ? ('carry on' as const) : ({ replay: link.setup } as const);
  }
  return inHand.has ? ('carry on' as const) : ('lineup' as const);
}

/** A setup or reading screen is up (choosing balls, setting up a series): no match is watched. */
export function isSetupScreen(screen: Screen, seriesPlaying: boolean): boolean {
  if (screen === 'series' || screen === 'online') return !seriesPlaying;
  return [
    'pick',
    'manual',
    'outdated',
    'challenge',
    'send',
    'start',
    'signin',
    'friends',
    'profile',
    'ranks',
  ].includes(screen);
}

/**
 * A fight is on screen: a Free play match before its result, a series round on the arena (its
 * ready card too), or a live match at any moment. A rematch notice waits until it is over.
 */
/** Where the screen on show stands: its match over, its series' phase, a live match on. */
export interface ScreenMoment {
  readonly matchOver: boolean;
  readonly phase: string | undefined;
  readonly live: boolean;
}

export function isFighting(screen: Screen, now: ScreenMoment): boolean {
  if (screen === 'match') return !now.matchOver;
  if (screen === 'online' && now.live) return true;
  return (screen === 'series' || screen === 'online') && now.phase === 'playing';
}

/**
 * Whether a friend's challenge may pop up now (ADR 0081): never over a fight or a lineup pick (a
 * series' lineup and its rounds, a live match's picks, a start's lineup, a coin toss); it waits
 * until the match is over. Every calm screen may show it. A rematch's card keeps its own rule
 * (`isFighting`, ADR 0070).
 */
export function invitesMayShow(screen: Screen, now: ScreenMoment): boolean {
  if (isFighting(screen, now)) return false;
  if (screen === 'start') return false;
  if (screen === 'series' || screen === 'online') return now.phase === 'finished';
  return true;
}

/**
 * A calm moment for the new-version line (ADR 0066): home, or an offline series that is over,
 * where a reload loses nothing (a series against the bot is saved after every change, ADR 0042).
 * Never during a match, a setup, or anything online: a live match runs on the server's clock.
 */
export function isCalmMoment(screen: Screen, seriesPhase: string | undefined): boolean {
  return screen === 'home' || (screen === 'series' && seriesPhase === 'finished');
}

const TITLES: Readonly<Record<Screen, string>> = {
  home: 'BallBattle: build a lineup, watch it fight',
  pick: 'Free play · BallBattle',
  match: 'Free play · BallBattle',
  series: 'Best of 3 · BallBattle',
  manual: 'Balls · BallBattle',
  outdated: 'Link from another version · BallBattle',
  online: 'Online series · BallBattle',
  challenge: 'Challenge · BallBattle',
  send: 'vs Friend · BallBattle',
  start: 'Your lineup · BallBattle',
  signin: 'Sign in · BallBattle',
  friends: 'Friends · BallBattle',
  profile: 'Profile · BallBattle',
  ranks: 'Ranks · BallBattle',
};

/** The vs Bot setup's title (ADR 0055): who the series is against, as its heading says. */
export const BOT_SETUP_TITLE = 'vs Bot · BallBattle';

/**
 * The page title on `screen`: a series names its length (ADR 0048), and a manual entry its ball.
 * `botSetup`: the series' first step, the vs Bot setup, which names its opponent instead.
 */
export function screenTitle(
  screen: Screen,
  bestOf?: number,
  ballName?: string,
  botSetup = false,
): string {
  if (screen === 'series' && botSetup) return BOT_SETUP_TITLE;
  if (screen === 'series' && bestOf === 5) return 'Best of 5 · BallBattle';
  if (screen === 'manual' && ballName !== undefined) return `${ballName} · ${TITLES.manual}`;
  return TITLES[screen];
}

/**
 * What the arena is showing, for its ready moment (ADR 0037): the home demo (`still` while it
 * waits under reduced motion, ADR 0055), a series round (a live one, ADR 0053, starts at its
 * server time, with no Fight!), or a Free play match.
 */
export function readyMomentOf(
  screen: Screen,
  seriesOnScreen: boolean,
  live: boolean,
  demoWaits = false,
): 'demo' | 'still' | 'series' | 'live' | 'quick' {
  if (screen === 'home') return demoWaits ? 'still' : 'demo';
  if (!seriesOnScreen) return 'quick';
  return live ? 'live' : 'series';
}
