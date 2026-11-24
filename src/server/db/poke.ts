// The poke's keys and switch (ADR 0082, `20261124120000_poke.sql`).
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

/** The player's poke key, if pokes are switched on in the database (`game.flags`) right now. */
export async function pokeKeyOf(sql: Db, userId: string): Promise<string | undefined> {
  const [row] = await sql<{ poke_key: string }[]>`
    select p.poke_key from game.profiles p
    where p.user_id = ${userId}
      and exists (select 1 from game.flags f where f.name = 'poke' and f.enabled)`;
  return row?.poke_key;
}

/**
 * A new poke key for the player, so a topic an old page or someone else learned goes quiet (Log
 * out). Deleting a player (Forget me, Delete account, Switch) deletes the key with the profile.
 */
export async function rotatePokeKey(sql: Db, userId: string): Promise<void> {
  await sql`update game.profiles set poke_key = default where user_id = ${userId}`;
}
