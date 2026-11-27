// The ball manual wired to the page: the index (roster or chart, one history entry) and a ball's
// entry (one more; moving from ball to ball replaces it, ADR 0025), and Try it leads to the
// quick-match setup. main.ts hands over how to move.
import { writeManualParams, writePickParams } from '../app/route.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createManual, type Manual } from '../ui/manual/manual.ts';
import type { ManualHost } from './ball-link.ts';

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
