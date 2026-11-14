// Other modes wired to the page (ADR 0046, 0048): each card goes straight to its mode's setup (a
// series format's lineup at the chosen length, or Free play with the demo's pair), one history step
// in; Back returns home. The length chosen here is remembered on the device, like the bot level.
// main.ts hands over how to move.
import { loadBotLevel } from '../app/bot-level.ts';
import type { Matchup } from '../app/matchup.ts';
import { writePickParams } from '../app/route.ts';
import { loadSeriesLength, saveSeriesLength } from '../app/series-length.ts';
import { writeSeriesModeParams } from '../app/series-url.ts';
import { createModes } from '../ui/modes.ts';
import { browserStorage as storage } from '../app/storage.ts';

export interface ModesHost {
  /** Moves to the screen `write` describes, by the Back rules, and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** Back from Other modes when the visitor arrived on it from a link: home, in place of it. */
  back(): void;
  /** Free play opens on the pair the demo is showing, as from home before (ADR 0020). */
  freePlay(): Matchup;
}

export interface ModesScreen {
  setVisible(visible: boolean): void;
  show(): void;
}

export function createModesScreen(root: HTMLElement, host: ModesHost): ModesScreen {
  const modes = createModes(root, {
    onBack: () => {
      host.back();
    },
    onLength: (bestOf) => {
      saveSeriesLength(storage, bestOf);
    },
    onPick: (mode, bestOf) => {
      if (mode.kind === 'free') {
        const pair = host.freePlay();
        host.go((url) => {
          writePickParams(url, pair);
        });
        return;
      }
      host.go((url) => {
        writeSeriesModeParams(url, mode.format, 'lineup', bestOf);
      });
    },
  });
  return {
    setVisible: (visible) => {
      modes.setVisible(visible);
    },
    // The level as last chosen on this device: the lineup step may have changed it.
    show: () => {
      modes.open(loadBotLevel(storage), loadSeriesLength(storage));
    },
  };
}
