// The Play tab's wiring (home, ADR 0081): the demo matches on the arena behind the menu, one after
// another (lively pairs from the counter map, not announced as counters); the mode box and its sheet,
// Play and Free play (ADR 0055, 0081 Option B). main.ts owns the arena and hands this module what it
// needs through `HomeHost`.
import { demoAt } from '../app/demo.ts';
import {
  loadPlayChoice,
  loadPlaySetup,
  PLAY_CHOICES,
  savePlayChoice,
  writePlayParams,
  type FriendSetup,
} from '../app/modes.ts';
import { writePickParams, writeShellParams } from '../app/route.ts';
import { browserStorage as storage } from '../app/storage.ts';
import { generateSeed } from '../app/fresh-seed.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { SeriesState } from '../sim/series.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { createHome } from '../ui/home.ts';

/** How long a finished demo's result stays up before the next demo starts. */
const NEXT_DEMO_MS = 2500;

export interface HomeHost {
  showWorld(world: WorldState, seed: number): void;
  /** Moves to the screen `write` describes, by the Back rules, and shows it. */
  go(write: (params: URLSearchParams) => void): void;
  /** An undecided series held (a Back, or saved before a reload): Play resumes it instead. */
  held(): SeriesState | undefined;
  /** Carries on with the held series. */
  resume(): void;
  /** Forgets the held series (New series opens Play's lineup after it). */
  forget(): void;
  /**
   * Play against a friend (online builds): a live challenge on these rules, straight to the link
   * to share, the 16+ question first on a device without a guest. Busy until it shows.
   */
  playFriend(setup: FriendSetup): Promise<void>;
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
  /** The status strip's line from the inbox, or nothing (ADR 0081). */
  setStatus(line: string | undefined): void;
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

  /** Play (ADR 0055): the last series set up against the bot, at its lineup, one tap from home. */
  const play = () => {
    host.go((url) => {
      writePlayParams(url, loadPlaySetup(storage));
    });
  };

  const home = createHome(root, balls, PLAY_CHOICES, {
    onPlay: (choice) => {
      if (choice.opponent === 'friend') return host.playFriend(choice.friend);
      if (host.held() !== undefined) host.resume();
      else play();
      return undefined;
    },
    onNewSeries: () => {
      host.forget();
      play();
    },
    // Each opponent's rules are remembered as they are chosen (ADR 0081 addendum).
    onChoice: (choice) => {
      savePlayChoice(storage, choice);
    },
    // Free play opens on the pair the demo is showing (ADR 0020).
    onFreePlay: () => {
      host.go((url) => {
        writePickParams(url, demoAt(index).matchup);
      });
    },
    onStatus: () => {
      host.go((url) => {
        writeShellParams(url, 'friends');
      });
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
    const { matchup } = demoAt(index);
    const seed = generateSeed();
    host.showWorld(
      createWorld(seed, [getDefinition(lookup, matchup.a), getDefinition(lookup, matchup.b)]),
      seed,
    );
    home.showDemo(matchup.a, matchup.b);
  }

  return {
    setVisible(visible) {
      home.setVisible(visible);
    },
    open() {
      // As last chosen on this device: a setup or a lineup may have changed it.
      home.setPlay(loadPlayChoice(storage, PLAY_CHOICES), host.held());
      waiting = reducedMotion.matches;
      home.setWaiting(waiting);
      startDemo();
      home.arrive();
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
    setStatus(line) {
      home.setStatus(line);
    },
  };
}
