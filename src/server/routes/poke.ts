// GET /api/v1/me/poke (ADR 0082): where this player's page may listen for pokes. Off unless the
// functions have `BALLBATTLE_POKE=1` (with `SUPABASE_BROWSER_KEY`) and `game.flags`' `poke` is on;
// off, the page polls exactly as it always has. Asked once per page load and on each return to
// visible, so it is counted as a read. Guests are answered too: a guest's page listens only during
// an online flow (decision 6), which the page decides.
import { decodePoke, socketUrlOf, type PokeResponse } from '../../api/poke.ts';
import { pokeKeyOf } from '../db/poke.ts';
import { guard } from '../guard.ts';
import { json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { sessionOf } from '../session.ts';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const mePoke: RouteHandler = async (request, context) => {
  guard(request, ['GET']);
  const player = await sessionOf(request, context);
  const { config, sql } = context.deps;
  if (config.pokeKey === undefined)
    return json(200, { off: true } satisfies PokeResponse, NO_STORE);
  await spend(sql, player.userId, LIMITS.reads);
  const pokeKey = await pokeKeyOf(sql, player.userId);
  const body: PokeResponse =
    pokeKey === undefined
      ? { off: true }
      : decodePoke({
          url: socketUrlOf(config.supabaseUrl),
          key: config.pokeKey,
          topic: `p:${pokeKey}`,
        });
  return json(200, body, NO_STORE);
};
