// What Play's place on home shows (ADR 0053, ADR 0089 addendum of 2026-11-27, the setup phase):
// Play, the way back to a live match, lineup or lobby, or Play waiting. Play never offers an action
// it doesn't know is right: on each arrival it waits for `/me/match` unless this page already knows
// the player is in something (a lineup it showed, a match, a lobby), which shows at once and is
// then confirmed. A device that never played online has nothing to go back to. Pure.
import type { CurrentMatch } from '../api/live.ts';

export type HomePlay =
  | { readonly kind: 'play' }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'back'; readonly match: CurrentMatch };

const PLAY: HomePlay = { kind: 'play' };

/**
 * On arriving at home: `known` is what this page last learnt of the player's live match this visit
 * (a match, nothing, or not learnt). Only a match is trusted before the server answers: "nothing"
 * may have changed on another device, a lineup on screen a moment ago can't have.
 */
export function homeOnArrival(
  playedOnline: boolean,
  known: CurrentMatch | null | undefined,
): HomePlay {
  if (!playedOnline) return PLAY;
  return known == null ? { kind: 'waiting' } : { kind: 'back', match: known };
}

/**
 * The server answered (`undefined`: it couldn't be asked, offline or failing). Not knowable while
 * waiting, Play shows: vs Bot works offline, and the server refuses a second match itself
 * (`in_a_match`), saying why. Already showing something, it stays until an answer knows better.
 */
export function homeOnAnswer(shown: HomePlay, answer: CurrentMatch | null | undefined): HomePlay {
  if (answer === undefined) return shown.kind === 'waiting' ? PLAY : shown;
  return answer === null ? PLAY : { kind: 'back', match: answer };
}
