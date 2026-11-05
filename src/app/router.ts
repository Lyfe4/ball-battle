// Shows the screen a route names (ADR 0020). Each screen registers a handler: how to show it for a
// route, and what to stop when leaving it. A new screen adds one handler, not a branch. Pure (no
// DOM), so the leaving and showing order is tested.
import type { Route, Screen } from './route.ts';

export type RouteOf<S extends Screen> = Extract<Route, { readonly screen: S }>;

export interface ScreenHandler<S extends Screen> {
  /** Shows the screen for `route`; `from` is the screen that was up before (the same on reload). */
  show(route: RouteOf<S>, from: Screen): void;
  /** Leaving this screen for another: stop whatever it runs (a queued demo, a series). */
  leave?(): void;
}

export type ScreenHandlers = { readonly [S in Screen]: ScreenHandler<S> };

export interface Router {
  /** The screen on show. */
  current(): Screen;
  /** Leaves the current screen if the route names another, lays the page out and shows it. */
  show(route: Route): void;
}

/**
 * `layout` runs after the current screen changes and before the handler shows it, so a handler
 * sees the page laid out for its own screen.
 */
export function createRouter(
  handlers: ScreenHandlers,
  initial: Screen,
  layout: (screen: Screen) => void,
): Router {
  let current = initial;

  // Generic over the screen, so the handler found for a route takes that route's own type.
  const handlerOf = <S extends Screen>(route: RouteOf<S>): ScreenHandler<S> =>
    handlers[route.screen];

  return {
    current: () => current,
    show(route) {
      const from = current;
      if (from !== route.screen) handlers[from].leave?.();
      current = route.screen;
      layout(current);
      handlerOf(route).show(route, from);
    },
  };
}
