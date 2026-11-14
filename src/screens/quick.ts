// Quick-match wiring: the setup screen where the two balls are chosen, the match screen (starting a
// match, or carrying on with it), and its own actions (Change balls, Home). main.ts owns the arena
// and the screens and hands this module what it needs through `QuickHost`.
import { createSettingsToggle } from '../ui/settings-menu.ts';
import type { Matchup } from '../app/matchup.ts';
import type { Navigation } from '../app/navigation.ts';
import { writeMatchUrl, writePickParams, type Screen } from '../app/route.ts';
import type { RouteOf } from '../app/router.ts';
import { resumesMatch, type AppState } from '../app/screen-rules.ts';
import { generateSeed } from '../app/fresh-seed.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { element } from '../ui/dom.ts';
import type { BallInfoLink } from '../ui/balls/ball-link.ts';
import { createQuickSetup } from '../ui/quick-setup.ts';

export interface QuickHost {
  readonly navigation: Navigation;
  /** Moves to the screen `write` describes, by the Back rules (ADR 0025), and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** The quick match last played or chosen, and the seed on screen. */
  readonly state: AppState;
  /** Puts a new match on screen. */
  showWorld(world: WorldState, seed: number): void;
  /** Home, or home in place of this entry when it is a Back fallback. */
  goHome(how?: 'go' | 'replace'): void;
  /** A match started: focus moves to the arena. */
  started(): void;
  readonly ballLink: BallInfoLink;
}

export interface QuickController {
  /** Shows the setup screen, the match screen's actions, or neither. */
  setVisible(screen: 'pick' | 'match' | 'other'): void;
  open(matchup: Matchup, focus?: 'heading' | 'start'): void;
  /**
   * The match screen for a route: a new match, or (Back from the setup to the match it covered)
   * the same one carrying on.
   */
  showMatch(route: RouteOf<'match'>, from: Screen): void;
  /**
   * Starts (or restarts) a match. The matchup and seed are written to the URL, so reloading or
   * sharing the link replays the same match, and a link with an invalid id is corrected.
   */
  startMatch(matchup: Matchup, seed: number): void;
}

export function createQuickController(
  setupRoot: HTMLElement,
  actionsRoot: HTMLElement,
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: QuickHost,
): QuickController {
  const { navigation, state } = host;

  function startMatch(matchup: Matchup, seed: number): void {
    state.matchup = matchup;
    navigation.replace((url) => {
      writeMatchUrl(url, matchup, seed);
    });
    const world = createWorld(seed, [
      getDefinition(lookup, matchup.a),
      getDefinition(lookup, matchup.b),
    ]);
    host.showWorld(world, seed);
  }
  const setup = createQuickSetup(setupRoot, balls, {
    onStart: (chosen) => {
      host.go((url) => {
        writeMatchUrl(url, chosen, generateSeed());
      });
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
  // Back to the setup this match came from (a Back, not a second copy of it), ADR 0025.
  changeBalls.addEventListener('click', () => {
    host.go((url) => {
      writePickParams(url, state.matchup);
    });
  });
  const home = element('button', 'hud-button', 'Home');
  home.type = 'button';
  home.addEventListener('click', () => {
    host.goHome();
  });
  actionsRoot.append(home, changeBalls, createSettingsToggle());

  return {
    setVisible(screen) {
      setup.setVisible(screen === 'pick');
      actionsRoot.hidden = screen !== 'match';
    },
    open(matchup, focus) {
      setup.open(matchup, focus);
    },
    showMatch(route, from) {
      if (resumesMatch(route, from, state)) return;
      startMatch(route.matchup, route.seed ?? generateSeed());
    },
    startMatch,
  };
}
