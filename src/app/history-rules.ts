// What Back does (ADR 0025), as one pure rule for every move between screens, so it is the same
// everywhere and tested as a table. Each route has a screen key; a move between two URLs either
// adds a history entry (push), rewrites this one (replace), or goes back to the entry it came from
// (return):
//
// 1. Back undoes exactly one screen move. A move that stays on the same screen key (a tab, a pick,
//    a format, the lineup tray, one ball's manual entry to another's, a series round to the next)
//    replaces the entry.
// 2. Going to the screen you just came from goes back to it instead of stacking a copy (Change
//    balls from a match, New series to the lineup).
// 3. A series is one entry: the round-1 answer, every round and the result share a key, so Back
//    from any of them lands on the lineup.
// 4. Play (home) is the root of the shell's tabs (ADR 0081); the other tabs sit one step above it.
//    A move between two of them replaces the entry, and a move from one to Play goes back to Play
//    when this page came from it, else puts Play in its place, so Back from Play leaves the game.
import type { Route } from './route.ts';

export type ScreenKey =
  | 'home'
  | 'pick'
  | 'match'
  | 'manual'
  | 'manual-entry'
  | 'series-rules'
  | 'series-lineup'
  | 'series'
  | 'outdated'
  | 'online'
  | 'challenge'
  | 'send'
  | 'start'
  | 'signin'
  | 'friends'
  | 'profile'
  | 'ranks';

export type Move = 'push' | 'replace' | 'return';

/** The shell's tabs above Play (ADR 0081): Balls (the manual's index or chart), Friends, Ranks. */
const TABS: readonly ScreenKey[] = ['manual', 'friends', 'ranks'];

/** The screen a route is on, for history: the level Back steps between. */
export function screenKeyOf(route: Route): ScreenKey {
  switch (route.screen) {
    case 'manual':
      return route.ball === undefined ? 'manual' : 'manual-entry';
    case 'series':
      if (route.step === 'rules') return 'series-rules';
      if (route.step === 'lineup') return 'series-lineup';
      return 'series';
    default:
      return route.screen;
  }
}

/**
 * How to move from the screen on show (`from`) to `to`; `previous` is the screen of the entry
 * before this one, when this page pushed it.
 */
export function moveFor(from: ScreenKey, to: ScreenKey, previous: ScreenKey | undefined): Move {
  if (from === to) return 'replace';
  if (previous === to) return 'return';
  const tab = TABS.includes(from);
  if (tab && TABS.includes(to)) return 'replace';
  if (tab && to === 'home') return 'replace';
  return 'push';
}
