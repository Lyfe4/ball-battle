// The ball manual wired to the page: the index (roster or chart, one history entry) and a ball's
// entry (one more; moving from ball to ball replaces it, ADR 0025), and Try it leads to the
// quick-match setup. main.ts hands over how to move.
import { writeManualParams, writePickParams } from '../app/route.ts';
import type { BallDefinition } from '../sim/types.ts';
import type { BallInfoLink } from '../ui/balls/ball-link.ts';
import { createManual, type Manual } from '../ui/manual/manual.ts';

export interface ManualHost {
  /** Moves to the screen `write` describes, by the Back rules, and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** Back from the manual when the visitor arrived on it from a link: home, in place of it. */
  back(): void;
}

export function createManualScreen(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  host: ManualHost,
): Manual {
  return createManual(root, balls, {
    onBack: () => {
      host.back();
    },
    onOpen: (ball) => {
      host.go((url) => {
        writeManualParams(url, { ball });
      });
    },
    onTab: (chart) => {
      host.go((url) => {
        writeManualParams(url, { chart });
      });
    },
    onTry: (chosen) => {
      host.go((url) => {
        writePickParams(url, chosen);
      });
    },
  });
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
