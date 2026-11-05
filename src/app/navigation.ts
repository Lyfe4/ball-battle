// Moving between screens with the browser's history (pushState / replaceState / popstate), so Back
// and Forward work and every screen has a URL. Each entry this page pushes carries its depth, so an
// in-app Back button knows whether there is a screen of ours to go back to, or whether the visitor
// arrived on this screen from a link (then Back goes to the screen's parent instead of leaving).
// The browser's window is passed in (main.ts passes `window`), so the depth rules are tested with a
// fake history. `go` applies the Back rules of ADR 0025 (history-rules.ts): each entry this page
// pushes also remembers the screen it came from, so going back to that screen is a Back, not a
// second copy of it.
import { moveFor, type Move, type ScreenKey } from './history-rules.ts';

interface EntryState {
  readonly depth: number;
  /** The screen of the entry before this one, when this page pushed it. */
  readonly previous?: ScreenKey;
}

const depthOf = (state: unknown): number =>
  typeof state === 'object' && state !== null && 'depth' in state && typeof state.depth === 'number'
    ? state.depth
    : 0;

const previousOf = (state: unknown): ScreenKey | undefined =>
  typeof state === 'object' &&
  state !== null &&
  'previous' in state &&
  typeof state.previous === 'string'
    ? (state.previous as ScreenKey)
    : undefined;

export interface Navigation {
  /**
   * Moves to the screen `write` describes by the Back rules: replace on the same screen, Back when
   * it is the screen this entry came from (the URL is then rewritten as `write` says, before the
   * change is reported), else a new entry. Returns the move: after `return` the screen is shown
   * by `onChange`, once the browser has gone back.
   */
  go(write: (params: URLSearchParams) => void): Move;
  /** Moves to another screen: a new history entry. Writing the same URL again adds none. */
  push(write: (params: URLSearchParams) => void): void;
  /** Rewrites this screen's URL (a new seed, a format): no new entry. */
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous entry if this page pushed one, else `toParent` (which replaces). */
  back(toParent: () => void): void;
  /** Runs on Back and Forward, after the URL has changed. */
  onChange(listener: () => void): void;
}

/** The parts of the browser's window navigation uses. History state survives a reload. */
export interface HistoryWindow {
  readonly history: {
    readonly state: unknown;
    pushState(data: unknown, unused: string, url: URL): void;
    replaceState(data: unknown, unused: string, url?: URL): void;
    back(): void;
  };
  readonly location: { readonly href: string };
  addEventListener(type: 'popstate', listener: (event: { readonly state: unknown }) => void): void;
}

/**
 * `keyOf` names the screen a URL is on (main.ts reads it with parseRoute and screenKeyOf); without
 * it every URL is its own screen.
 */
export function createNavigation(
  win: HistoryWindow,
  keyOf: (url: URL) => ScreenKey = (url) => url.href as ScreenKey,
): Navigation {
  const { history } = win;
  // After a reload the entry keeps the depth (and the screen it came from) it was pushed with.
  let depth = depthOf(history.state);
  let previous = previousOf(history.state);
  /** A `go` that went back: how to rewrite the entry it lands on. */
  let pending: ((params: URLSearchParams) => void) | undefined;
  const entry = (): EntryState => (previous === undefined ? { depth } : { depth, previous });
  history.replaceState(entry(), '');
  const listeners: (() => void)[] = [];
  win.addEventListener('popstate', (event) => {
    depth = depthOf(event.state);
    previous = previousOf(event.state);
    if (pending !== undefined) {
      replace(pending);
      pending = undefined;
    }
    for (const listener of listeners) listener();
  });

  function edit(write: (params: URLSearchParams) => void): URL {
    const url = new URL(win.location.href);
    write(url.searchParams);
    return url;
  }

  function push(write: (params: URLSearchParams) => void): void {
    const url = edit(write);
    if (url.href === win.location.href) return;
    const from = keyOf(new URL(win.location.href));
    depth += 1;
    previous = from;
    history.pushState(entry(), '', url);
  }

  function replace(write: (params: URLSearchParams) => void): void {
    history.replaceState(entry(), '', edit(write));
  }

  return {
    go(write) {
      const move = moveFor(keyOf(new URL(win.location.href)), keyOf(edit(write)), previous);
      if (move === 'return') {
        pending = write;
        history.back();
      } else if (move === 'replace') replace(write);
      else push(write);
      return move;
    },
    push,
    replace,
    back(toParent) {
      if (depth > 0) history.back();
      else toParent();
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };
}
