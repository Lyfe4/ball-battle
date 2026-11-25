// One `/me` (ADR 0087, "One read per answer"): the avatar and the screen on show (Friends, Profile,
// sign-in) ask who this device plays as at the same moment on a cold open; they share one question
// on its way rather than asking twice. The answer is kept for the visit (visit-cache.ts) so a screen
// opened again shows it at once while it asks again in place. Not known (offline, failing) is never
// kept: the next ask asks.
import type { VisitCache, VisitKey } from './visit-cache.ts';
import type { WhoAmI } from './who-am-i.ts';

export interface WhoSource {
  /** What `/me` last said this visit, if it said anything known. */
  known(): WhoAmI | undefined;
  /** Asks `/me`, sharing a question already on its way. */
  ask(): Promise<WhoAmI>;
}

export const ME: VisitKey<WhoAmI> = { name: 'me' };

/** `read` asks the server (whoAmI with the device's storage and cookies); `cache` keeps the answer. */
export function createWhoSource(read: () => Promise<WhoAmI>, cache: VisitCache): WhoSource {
  let pending: { readonly generation: number; readonly answer: Promise<WhoAmI> } | undefined;
  return {
    known: () => cache.read(ME),
    ask() {
      const generation = cache.generation();
      // A question asked before who the player is changed is not this player's to share.
      if (pending?.generation === generation) return pending.answer;
      const answer = read().then((who) => {
        if (pending?.answer === answer) pending = undefined;
        if (who.kind !== 'unknown' && cache.generation() === generation) cache.write(ME, who);
        return who;
      });
      pending = { generation, answer };
      return answer;
    },
  };
}
