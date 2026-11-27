// Home's way back to a live match, lineup or lobby (ADR 0053) and what Play's place shows meanwhile
// (ADR 0089 addendum of 2026-11-27, home-play-state.ts): a match this page knows of at once, else
// Play waiting until `/me/match` answers, so Play never offers what it can't vouch for. And the
// one "Back to it" the who sheet and the Friends tab share while the player is in a game.
import { homeOnAnswer, homeOnArrival, type HomePlay } from '../app/home-play-state.ts';
import { knownLive, rememberLive } from '../app/live-memory.ts';
import { hasGuest, type DeviceStorage } from '../app/online-device.ts';
import { visitCache } from '../app/visit-cache.ts';
import type { CurrentMatch } from '../api/live.ts';
import { createBackToMatch } from '../ui/online/back-to-match.ts';
import { currentMatch } from './current-match.ts';

export interface HomeBack {
  readonly element: HTMLElement;
  /** Home shows: a known match's way back at once, else Play waiting for the server. */
  arrive(): HomePlay;
  /** Asks the server (only on a device that has played online) and shows its answer. */
  refresh(): Promise<HomePlay>;
  /** For a lobby shown, how long until it stops unless its page is heard from. */
  stopsInMs(): number | undefined;
  /** The player's lobby is known gone (cancelled here): Play at once. */
  gone(): void;
}

/** `toMatch` goes to a match once its screen is read (ADR 0054). */
export function createHomeBack(
  storage: DeviceStorage,
  toMatch: (match: CurrentMatch) => Promise<void>,
): HomeBack {
  const back = createBackToMatch(toMatch);
  /** The lobby home last showed: it stops by the clock, which pokes nobody. */
  let lobbyStops: number | undefined;
  let homePlay: HomePlay = { kind: 'play' };
  const showHome = (next: HomePlay): HomePlay => {
    homePlay = next;
    const match = next.kind === 'back' ? next.match : null;
    lobbyStops = match?.kind === 'lobby' ? match.stopsInMs : undefined;
    back.show(match);
    return next;
  };
  return {
    element: back.element,
    stopsInMs: () => lobbyStops,
    arrive: () => showHome(homeOnArrival(hasGuest(storage), knownLive())),
    async refresh() {
      if (!hasGuest(storage)) return showHome({ kind: 'play' });
      const generation = visitCache.generation();
      const match = await currentMatch();
      // An answer asked for another player (a sign-in meanwhile) isn't this one's.
      if (generation !== visitCache.generation()) return homePlay;
      if (match !== undefined) rememberLive(match);
      return showHome(homeOnAnswer(homePlay, match));
    },
    gone() {
      rememberLive(null);
      showHome({ kind: 'play' });
    },
  };
}

/**
 * Back to the live game the player is in (lineups or match), asked of the server when tapped so it
 * is never stale; with no answer, the one this page knows. False when there is none (a lobby of
 * one's own isn't one): the caller draws its challenges again.
 */
export function createBackToGame(
  toMatch: (match: CurrentMatch) => Promise<void>,
): () => Promise<boolean> {
  return async () => {
    const asked = await currentMatch();
    if (asked !== undefined) rememberLive(asked);
    const match = asked === undefined ? knownLive() : asked;
    if (match == null || match.kind === 'lobby') return false;
    await toMatch(match);
    return true;
  };
}
