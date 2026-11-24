// Accounts and friendships for database tests (ADR 0079): made straight in the tables, as the
// tests about the inbox and challenging a friend need them, without the sign-in steps.
import type { Sql } from '../db.ts';
import type { Deps } from '../http.ts';
import { newPlayer, type Player } from './series-support.ts';

let names = 0;

/** Makes `player` an account with a username of its own; returns the username. */
export async function makeAccount(admin: Sql, player: Player): Promise<string> {
  names += 1;
  const username = `i${String(Date.now() % 1e7)}x${String(names)}`.slice(0, 15);
  await admin`
    update game.profiles set account_at = now(), username = ${username}
    where user_id = ${player.userId}`;
  return username;
}

/** A new player who is an account. */
export async function newAccount(deps: Deps, admin: Sql): Promise<Player & { username: string }> {
  const player = await newPlayer(deps);
  return { ...player, username: await makeAccount(admin, player) };
}

/** The row between two players: accepted friends, or a request from `a`. Returns its id. */
export async function befriend(admin: Sql, a: Player, b: Player, accepted = true): Promise<string> {
  const [low, high] = a.userId < b.userId ? [a.userId, b.userId] : [b.userId, a.userId];
  const [row] = await admin<{ id: string }[]>`
    insert into game.friendships (low, high, requested_by, accepted_at)
    values (${low}, ${high}, ${a.userId}, ${accepted ? new Date() : null}) returning id`;
  return row?.id ?? '';
}
