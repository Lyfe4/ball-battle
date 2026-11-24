// The page's poke hub (ADR 0082, `poke-hub.ts`): undefined in a build without `VITE_POKE`, so every
// `pokes?.…` falls back to the timers it always had, and none of the poke's code is bundled.
import { decodePoke } from '../api/poke.ts';
import { callApi } from './api.ts';
import { createPokeHub, type PokeHub } from './poke-hub.ts';
import { POKE_BUILD } from './poke-build.ts';
import { browserPokePage } from './poke-page.ts';
import { openPokeSocket } from './poke-socket.ts';

export const pokes: PokeHub | undefined = POKE_BUILD
  ? createPokeHub({
      ask: async () => {
        const answer = await callApi<unknown>('GET', 'me/poke');
        return answer.ok ? decodePoke(answer.body) : { off: true };
      },
      open: openPokeSocket,
      page: browserPokePage(),
    })
  : undefined;
