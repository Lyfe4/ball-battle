// The ball manual wired to the page: its pages are history entries (the roster, the chart, one entry
// per ball), and Try it leads to the quick-match setup. main.ts hands over how to move.
import { writeManualParams, writePickParams } from './app/route.ts';
import type { BallDefinition } from './sim/types.ts';
import type { BallInfoLink } from './ui/balls/ball-info.ts';
import { createManual, type Manual } from './ui/manual/manual.ts';

export interface ManualHost {
  /** Writes the URL of another screen (a new entry, or in place of this one) and shows it. */
  go(write: (params: URLSearchParams) => void, how?: 'push' | 'replace'): void;
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
    onOpen: (ball, how) => {
      host.go((url) => {
        writeManualParams(url, { ball });
      }, how);
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
