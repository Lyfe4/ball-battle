// The Play tab's wiring (home, ADR 0081): the demo matches on the arena behind the menu, one after
// another (lively pairs from the counter map, not announced as counters); the mode box and its sheet,
// Play and Free play (ADR 0055, 0081 Option B). main.ts owns the arena and hands this module what it
// needs through `HomeHost`.
import { demoAt } from '../app/demo.ts';
import { firstSeries } from '../app/first-series-device.ts';
import { FIRST_SERIES } from '../app/first-series-setup.ts';
import {
  loadPlayChoice,
  loadPlaySetup,
  PLAY_CHOICES,
  savePlayChoice,
  writePlayParams,
  type FriendSetup,
  type PlayChoice,
} from '../app/modes.ts';
import { writePickParams } from '../app/route.ts';
import { browserStorage as storage } from '../app/storage.ts';
import { generateSeed } from '../app/fresh-seed.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { SeriesState } from '../sim/series.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { TURNS_BUILD } from '../app/turns-build.ts';
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
   * Play against a friend (online builds; made after home, so asked for when needed): signed in,
   * "Who do you want to play?" (ADR 0089 addendum of 2026-11-27), else a live challenge on these
   * rules straight to the link to share, the 16+ question first on a device without a guest. Busy
   * until it shows.
   */
  friends(): {
    playFriend(setup: FriendSetup): Promise<void>;
    /** Whether Play asks who (signed in) rather than sending a link. */
    readonly asksWho?: () => boolean;
  };
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

  /**
   * Play (ADR 0055): the last series set up against the bot, at its lineup, one tap from home; on a
   * first visit, the guided first series (ADR 0090), never saved as Play's.
   */
  const play = () => {
    // The guided series starts here: remembered before it writes keys of its own.
    if (!firstSeries.done()) firstSeries.begin();
    host.go((url) => {
      writePlayParams(url, firstSeries.done() ? loadPlaySetup(storage) : FIRST_SERIES);
    });
  };

  /** What the box and Play say now: on a first visit, the first series against the bot. */
  const showPlay = () => {
    const remembered = loadPlayChoice(storage, PLAY_CHOICES);
    const first = !firstSeries.done();
    const choice: PlayChoice = first
      ? { ...remembered, opponent: 'bot', bot: FIRST_SERIES }
      : remembered;
    home.setPlay(choice, host.held(), first);
  };

  const home = createHome(root, balls, PLAY_CHOICES, {
    onPlay: (choice) => {
      if (choice.opponent === 'friend') return host.friends().playFriend(choice.friend);
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
    // The whole tab at once, in place: no reload, no other screen (ADR 0090, D6).
    onSkip: () => {
      firstSeries.skip();
      showPlay();
      home.arrive();
    },
    // Free play opens on the pair the demo is showing (ADR 0020).
    onFreePlay: () => {
      host.go((url) => {
        writePickParams(url, demoAt(index).matchup);
      });
    },
    asksWho: () => host.friends().asksWho?.() ?? false,
    turns: TURNS_BUILD,
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
      showPlay();
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
  };
}
