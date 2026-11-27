// How the page reaches the ball manual without loading it (manual-lazy.ts): the pickers' info
// cards link to a ball's entry, and the manual's host is how the manual moves.
import { writeManualParams } from '../app/route.ts';
import type { BallInfoLink } from '../ui/balls/ball-link.ts';

export interface ManualHost {
  /** Moves to the screen `write` describes, by the Back rules, and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** Back from the manual when the visitor arrived on it from a link: home, in place of it. */
  back(): void;
}

/** The pickers' info cards link to a ball's manual entry: a real link, opened in the app. */
export function createBallLink(go: ManualHost['go']): BallInfoLink {
  return {
    href: (ball) => {
      const url = new URL(window.location.href);
      writeManualParams(url.searchParams, { ball });
      return `${url.pathname}${url.search}`;
    },
    open: (ball) => {
      go((url) => {
        writeManualParams(url, { ball });
      });
    },
  };
}
