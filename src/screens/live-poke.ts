// The live match on the Realtime poke (ADR 0082, PR 7): the page's socket is wanted while an open
// live series shows. A `match` poke (the other's pick, a round settled, a forfeit) reads at once,
// and with the socket up the 1 s waiting reads go, the 2 s heartbeat staying (live-ask.ts).
import { HEARTBEAT_ASK_MS } from '../app/live-ask.ts';
import { createPokePace, type PokePace } from '../app/poke-pace.ts';
import { pokes } from '../app/pokes.ts';

export interface LivePoke {
  /** Whether an open live series shows (wanting the socket); answers whether pokes are up. */
  showing(on: boolean): boolean;
}

/** `series.poke()` reads the series now (or once the read that is out is back). */
export function createLivePoke(series: { poke(): void }): LivePoke {
  let pace: PokePace | undefined;
  return {
    showing(on) {
      if (on) {
        pace ??= createPokePace(pokes, HEARTBEAT_ASK_MS, () => {
          series.poke();
        });
      } else {
        pace?.stop();
        pace = undefined;
      }
      return pace?.up === true;
    },
  };
}
