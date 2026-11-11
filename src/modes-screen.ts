// Other modes wired to the page (ADR 0046): each card goes straight to its mode's setup (a Best of 3
// format's lineup, or Free play with the demo's pair), one history step in; Back returns home.
// main.ts hands over how to move.
import { loadBotLevel } from './app/bot-level.ts';
import type { Matchup } from './app/matchup.ts';
import { writePickParams } from './app/route.ts';
import { writeSeriesModeParams } from './app/series-url.ts';
import { createModes } from './ui/modes.ts';

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
    onPick: (mode) => {
      if (mode.kind === 'free') {
        const pair = host.freePlay();
        host.go((url) => {
          writePickParams(url, pair);
        });
        return;
      }
      host.go((url) => {
        writeSeriesModeParams(url, mode.format, 'lineup');
      });
    },
  });
  return {
    setVisible: (visible) => {
      modes.setVisible(visible);
    },
    // The level as last chosen on this device: the lineup step may have changed it.
    show: () => {
      modes.open(loadBotLevel(() => window.localStorage));
    },
  };
}
