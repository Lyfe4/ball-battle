// Quick-match wiring: the setup screen where the two balls are chosen, and the match screen's own
// actions (Change balls, Home). main.ts owns the arena and the screens and hands this module what it
// needs through `QuickHost`.
import type { Matchup } from './app/matchup.ts';
import { writeMatchUrl, writePickParams } from './app/route.ts';
import { generateSeed } from './app/seed.ts';
import type { Navigation } from './navigation.ts';
import type { BallDefinition } from './sim/types.ts';
import { element } from './ui/dom.ts';
import type { BallInfoLink } from './ui/balls/ball-info.ts';
import { createQuickSetup } from './ui/quick-setup.ts';

export interface QuickHost {
  readonly navigation: Navigation;
  /** Shows whatever screen the URL now names. */
  showCurrentRoute(): void;
  /** The quick match last played or chosen. */
  matchup(): Matchup;
  /** Home: a new history entry, or in place of this one when it is a Back fallback. */
  goHome(how?: 'push' | 'replace'): void;
  /** A match started: focus moves to the arena. */
  started(): void;
  readonly ballLink: BallInfoLink;
}

export interface QuickController {
  /** Shows the setup screen, the match screen's actions, or neither. */
  setVisible(screen: 'pick' | 'match' | 'other'): void;
  open(matchup: Matchup, focus?: 'heading' | 'start'): void;
}

export function createQuickController(
  setupRoot: HTMLElement,
  actionsRoot: HTMLElement,
  balls: readonly BallDefinition[],
  host: QuickHost,
): QuickController {
  const { navigation } = host;
  const setup = createQuickSetup(setupRoot, balls, {
    onStart: (chosen) => {
      navigation.push((url) => {
        writeMatchUrl(url, chosen, generateSeed());
      });
      host.showCurrentRoute();
      host.started();
    },
    onChange: (chosen) => {
      navigation.replace((url) => {
        writePickParams(url, chosen);
      });
    },
    ballLink: host.ballLink,
    // Arriving on the setup from a link, Back goes to the home screen.
    onBack: () => {
      navigation.back(() => {
        host.goHome('replace');
      });
    },
  });

  const changeBalls = element('button', 'hud-button', 'Change balls');
  changeBalls.type = 'button';
  changeBalls.addEventListener('click', () => {
    navigation.push((url) => {
      writePickParams(url, host.matchup());
    });
    host.showCurrentRoute();
  });
  const home = element('button', 'hud-button', 'Home');
  home.type = 'button';
  home.addEventListener('click', () => {
    host.goHome();
  });
  actionsRoot.append(home, changeBalls);

  return {
    setVisible(screen) {
      setup.setVisible(screen === 'pick');
      actionsRoot.hidden = screen !== 'match';
    },
    open(matchup, focus) {
      setup.open(matchup, focus);
    },
  };
}
