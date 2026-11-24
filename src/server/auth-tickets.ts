// Tickets for what we ask Auth to do (ADR 0082, decision 2). Once the browser holds a publishable
// key, anyone can call Auth's `/signup` and `/otp` directly; Auth's hooks
// (`20261124090000_auth_hooks.sql`) refuse a sign-up without a ticket and an email whose address has
// none. Each ticket is written just before the Auth call that uses it, works once and for a minute.
// A ticket is one statement on the connection, before the Auth call (one query at a time, ADR 0052).
import type { Sql } from './db.ts';

/** A new sign-up ticket: 128 random bits, base64url. */
export function newTicket(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** What the next Auth call will do: send a code to `email`, and/or make a user with `signUp`. */
export interface Expected {
  readonly email?: string;
  readonly signUp?: string;
}

/** Writes the tickets for one Auth call, in one statement. */
export async function expectAuth(sql: Sql, expected: Expected): Promise<void> {
  const { email, signUp } = expected;
  if (email !== undefined && signUp !== undefined) {
    await sql`select game.expect_auth('email', ${email}), game.expect_auth('signup', ${signUp})`;
  } else if (email !== undefined) {
    await sql`select game.expect_auth('email', ${email})`;
  } else if (signUp !== undefined) {
    await sql`select game.expect_auth('signup', ${signUp})`;
  }
}

/** The user metadata that carries a sign-up ticket to the before-user-created hook. */
export const ticketData = (signUp: string): { readonly bb_ticket: string } => ({
  bb_ticket: signUp,
});
