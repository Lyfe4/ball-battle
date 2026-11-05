// The home screen's wiring: the demo matches on the arena behind the menu, one after another, each a
// counter from the counter map; and where Play leads. main.ts owns the arena and hands this module
// what it needs through `HomeHost`.
import { demoAt } from './app/demo.ts';
import type { Matchup } from './app/matchup.ts';
import { generateSeed } from './app/seed.ts';
import { getDefinition } from './sim/definitions.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from './sim/types.ts';
import { createWorld } from './sim/world.ts';
import { createHome } from './ui/home.ts';

/** How long a finished demo's result stays up before the next demo starts. */
const NEXT_DEMO_MS = 2500;

export interface HomeHost {
  showWorld(world: WorldState, seed: number): void;
  /** Play: the quick-match setup, prefilled. */
  play(matchup: Matchup): void;
  series(): void;
  manual(): void;
}

export interface HomeController {
  setVisible(visible: boolean): void;
  /** Shows home with a demo running (or waiting, under reduced motion) and focuses Play. */
  open(): void;
  /** True while the demo waits on a still frame for Watch (reduced motion). */
  isWaiting(): boolean;
  /** Each draw while home is up: queues the next demo once this one's result has shown. */
  drawn(resultShown: boolean): void;
  /** Leaving home: no demo is queued behind the next screen. */
  leave(): void;
}

export function createHomeController(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: HomeHost,
): HomeController {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // A random first demo, then the map in order, so repeat visits don't always open the same way.
  let index = generateSeed();
  let waiting = false;
  let queued: number | undefined;

  const home = createHome(root, balls, {
    onPlay: () => {
      // The demo's pair, the favoured ball yours: the counter just watched, ready to try.
      host.play(demoAt(index).matchup);
    },
    onSeries: () => {
      host.series();
    },
    onManual: () => {
      host.manual();
    },
    onWatch: () => {
      waiting = false;
      home.setWaiting(false);
      startDemo();
    },
  });

  function cancel(): void {
    if (queued !== undefined) window.clearTimeout(queued);
    queued = undefined;
  }

  /** Puts the current demo on the arena. Under reduced motion it holds its first frame. */
  function startDemo(): void {
    cancel();
    const { matchup, reason } = demoAt(index);
    const seed = generateSeed();
    host.showWorld(
      createWorld(seed, [getDefinition(lookup, matchup.a), getDefinition(lookup, matchup.b)]),
      seed,
    );
    home.showDemo(matchup.a, matchup.b, reason);
  }

  return {
    setVisible(visible) {
      home.setVisible(visible);
    },
    open() {
      waiting = reducedMotion.matches;
      home.setWaiting(waiting);
      startDemo();
      home.focus();
    },
    isWaiting: () => waiting,
    drawn(resultShown) {
      if (!resultShown || queued !== undefined || waiting) return;
      queued = window.setTimeout(() => {
        queued = undefined;
        index += 1;
        // Under reduced motion each demo waits for Watch, so nothing moves on its own.
        waiting = reducedMotion.matches;
        home.setWaiting(waiting);
        startDemo();
      }, NEXT_DEMO_MS);
    },
    leave: cancel,
  };
}
