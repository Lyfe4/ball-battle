// Moving between screens with the browser's history (pushState / replaceState / popstate), so Back
// and Forward work and every screen has a URL. Each entry this page pushes carries its depth, so an
// in-app Back button knows whether there is a screen of ours to go back to, or whether the visitor
// arrived on this screen from a link (then Back goes to the screen's parent instead of leaving).

interface EntryState {
  readonly depth: number;
}

const depthOf = (state: unknown): number =>
  typeof state === 'object' && state !== null && 'depth' in state && typeof state.depth === 'number'
    ? state.depth
    : 0;

export interface Navigation {
  /** Moves to another screen: a new history entry. Writing the same URL again adds none. */
  push(write: (params: URLSearchParams) => void): void;
  /** Rewrites this screen's URL (a new seed, a format): no new entry. */
  replace(write: (params: URLSearchParams) => void): void;
  /** In-app Back: the previous entry if this page pushed one, else `toParent` (which replaces). */
  back(toParent: () => void): void;
  /** Runs on Back and Forward, after the URL has changed. */
  onChange(listener: () => void): void;
}

export function createNavigation(): Navigation {
  let depth = depthOf(window.history.state);
  window.history.replaceState({ depth } satisfies EntryState, '');

  function edit(write: (params: URLSearchParams) => void): URL {
    const url = new URL(window.location.href);
    write(url.searchParams);
    return url;
  }

  return {
    push(write) {
      const url = edit(write);
      if (url.href === window.location.href) return;
      depth += 1;
      window.history.pushState({ depth } satisfies EntryState, '', url);
    },
    replace(write) {
      window.history.replaceState({ depth } satisfies EntryState, '', edit(write));
    },
    back(toParent) {
      if (depth > 0) window.history.back();
      else toParent();
    },
    onChange(listener) {
      window.addEventListener('popstate', (event) => {
        depth = depthOf(event.state);
        listener();
      });
    },
  };
}
