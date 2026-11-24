// The sender's lobby asking again (ADR 0053, 0082): while a live link waits, its card is asked for
// every LOBBY_POLL_MS (each ask keeps the link open, `creator_seen_at`), or only every
// LOBBY_SAFETY_MS with the poke socket up, where an accept, a decline or the start arrive by poke.
// A poke during an ask asks once more as soon as that ask is back.
import { createPokePace, type PokePace } from '../app/poke-pace.ts';
import { pokes } from '../app/pokes.ts';

/** How often a sender's lobby asks whether the friend has accepted: the lobby's heartbeat. */
const LOBBY_POLL_MS = 2_000;
/**
 * With the poke socket up (ADR 0082): an accept, a decline or the start arrive by poke, so the
 * lobby asks only this often, its heartbeat (`creator_seen_at` must stay inside 60 s).
 */
export const LOBBY_SAFETY_MS = 20_000;

export interface ChallengeLobby {
  /** Whether an ask is due (the lobby waits). */
  readonly waiting: () => boolean;
  /** The card shows a waiting lobby: its next ask. */
  next(): void;
  /** Stops asking (the card goes, or the sender leaves). */
  stop(): void;
}

/** `ask` reads the card again (and calls `next` once it shows a lobby still waiting). */
export function createChallengeLobby(ask: () => Promise<unknown>): ChallengeLobby {
  let timer: number | undefined;
  let pace: PokePace | undefined;
  let again = false;

  function stop(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    // The socket lingers a few seconds (poke-hub.ts): the lobby asking again keeps it.
    pace?.stop();
    pace = undefined;
  }

  /** A poke, or the socket going up or down: the lobby asks now, or once its ask is back. */
  function now(): void {
    if (timer === undefined) again = true;
    else {
      window.clearTimeout(timer);
      timer = undefined;
      void ask();
    }
  }

  return {
    waiting: () => timer !== undefined,
    next() {
      pace = createPokePace(pokes, LOBBY_SAFETY_MS, now);
      const ms = again ? 0 : pace.delay(LOBBY_POLL_MS);
      again = false;
      timer = window.setTimeout(() => {
        timer = undefined;
        void ask();
      }, ms);
    },
    stop,
  };
}
