// game.profiles: one row per player (ADR 0052, section 5).
import type { Sql } from '../db.ts';

export interface Profile {
  readonly userId: string;
  readonly name: string;
}

/** "Player 4821": four random digits, never anything the player typed. */
export function generatedName(): string {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return `Player ${String(1000 + (value % 9000))}`;
}

/** Makes a guest's profile, recording the 16+ confirmation at database time. */
export async function createProfile(sql: Sql, userId: string): Promise<Profile> {
  const name = generatedName();
  await sql`
    insert into game.profiles (user_id, display_name, adult_confirmed_at)
    values (${userId}, ${name}, now())
    on conflict (user_id) do nothing`;
  const profile = await profileOf(sql, userId);
  if (profile === undefined) throw new Error('A profile just made is missing');
  return profile;
}

/**
 * The player's profile, if they still have one, marking them seen (at most once a day, so reads
 * don't write on every request). The inactive-guest cleanup reads `last_seen_at`.
 */
export async function profileOf(sql: Sql, userId: string): Promise<Profile | undefined> {
  const [row] = await sql<{ readonly display_name: string }[]>`
    with seen as (
      update game.profiles set last_seen_at = now()
      where user_id = ${userId} and last_seen_at < now() - interval '1 day'
    )
    select display_name from game.profiles where user_id = ${userId}`;
  return row === undefined ? undefined : { userId, name: row.display_name };
}
