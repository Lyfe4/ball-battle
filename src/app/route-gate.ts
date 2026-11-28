// A screen whose code is still coming (online play's chunk, online-lazy.ts) shows once it has come:
// the screen on show stays until then, and only the last move asked for shows (a Back or another
// tap meanwhile wins). A screen that needs nothing shows at once, in the same task. Pure.
import type { Screen } from './route.ts';

/** Undefined when `screen` can show now; else it can once this resolves. */
export type ReadyFor = (screen: Screen) => Promise<void> | undefined;

/** `show`, each route waiting for `ready` where it must; called with none, the URL's (`read`). */
export function gateRoutes<R extends { readonly screen: Screen }>(
  read: () => R,
  ready: ReadyFor,
  show: (route: R) => void,
): (route?: R) => void {
  let moves = 0;
  return (route = read()) => {
    moves += 1;
    const move = moves;
    const waiting = ready(route.screen);
    if (waiting === undefined) {
      show(route);
      return;
    }
    void waiting.then(() => {
      if (move === moves) show(route);
    });
  };
}

/** `then` now if nothing is waited for, else once `waiting` resolves. */
export function afterReady(waiting: Promise<void> | undefined, then: () => void): void {
  if (waiting === undefined) then();
  else void waiting.then(then);
}
