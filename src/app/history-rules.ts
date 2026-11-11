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
import type { Route } from './route.ts';

export type ScreenKey =
  | 'home'
  | 'modes'
  | 'pick'
  | 'match'
  | 'manual'
  | 'manual-entry'
  | 'series-rules'
  | 'series-lineup'
  | 'series'
  | 'outdated';

export type Move = 'push' | 'replace' | 'return';

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
  return 'push';
}
