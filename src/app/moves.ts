// Moving between screens by the Back rules (ADR 0025), as main.ts and every screen's wiring use it:
// `navigation` decides push, replace or return; `show` puts the screen the URL now names on show.
import type { Navigation } from './navigation.ts';
import { writeHomeParams } from './route.ts';

export interface Moves {
  /**
   * Moves to the screen `write` describes by the Back rules and shows it: at once, or once the
   * browser has gone back to it.
   */
  readonly go: (write: (params: URLSearchParams) => void) => void;
  /** Shows another screen in place of this entry: the parent a Back falls back to. */
  readonly replaceWith: (write: (params: URLSearchParams) => void) => void;
  /** Moves to the home screen, or puts it in place of this entry (a parent fallback). */
  readonly goHome: (how?: 'go' | 'replace') => void;
}

export function createMoves(navigation: Navigation, show: () => void): Moves {
  const go = (write: (params: URLSearchParams) => void) => {
    if (navigation.go(write) !== 'return') show();
  };
  const replaceWith = (write: (params: URLSearchParams) => void) => {
    navigation.replace(write);
    show();
  };
  return {
    go,
    replaceWith,
    goHome: (how = 'go') => {
      if (how === 'replace') replaceWith(writeHomeParams);
      else go(writeHomeParams);
    },
  };
}
