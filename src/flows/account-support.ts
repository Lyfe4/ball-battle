// Accounts in the online flows (ADR 0079): an email code read from the local Supabase's mail
// catcher (Mailpit) and typed into the real page.
import type { Browser, Page } from 'playwright';
import postgres from 'postgres';
import { PHONE } from './live-support.ts';
import { allowLocalRealtime, blockRealtime, watchPage } from './realtime-support.ts';

/** The local Supabase's mail catcher (`supabase start`), where every code is sent. */
const MAILPIT = 'http://127.0.0.1:54324';
/** The local Supabase's database (`supabase start`), as its superuser. */
const LOCAL_DATABASE = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Forgets the local database's count of codes sent from this network. Every phone of a run is one
 * network to the server, and the suite sends codes to more addresses than the 20 an hour one
 * network may ask for (ADR 0079; the limit itself is tested in `email-limits.db.test.ts`). Local only, as the codes
 * are: the mail catcher and this database are the local stack's.
 */
async function forgetNetworkCodes(): Promise<void> {
  const sql = postgres(LOCAL_DATABASE, { max: 1, onnotice: () => undefined });
  try {
    await sql`delete from game.rate_limits where bucket in ('code.network', 'code.network.day', 'code.all.hour')`;
  } finally {
    await sql.end();
  }
}

/**
 * The turn of series by turns `id` runs out now (moved a minute into the past in the local
 * database): the next read settles it, as the sweep would in production (ADR 0085, 0086).
 */
export async function expireTurn(id: string): Promise<void> {
  const sql = postgres(LOCAL_DATABASE, { max: 1, onnotice: () => undefined });
  try {
    await sql`update game.series set turn_deadline = now() - interval '1 minute' where id = ${id}`;
  } finally {
    await sql.end();
  }
}

/** How many emails `email` has had. */
export async function mailCount(email: string): Promise<number> {
  const query = encodeURIComponent(`to:"${email}"`);
  const body = (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()) as {
    messages?: { ID: string }[];
  };
  return body.messages?.length ?? 0;
}

/** The code in `email`'s newest email, once there are more than `before`. */
export async function codeFor(email: string, before: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const query = encodeURIComponent(`to:"${email}"`);
    const { messages = [] } = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
    ).json()) as { messages?: { ID: string }[] };
    const newest = messages[0];
    if (messages.length > before && newest !== undefined) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as {
        Text: string;
      };
      const code = /\b\d{6}\b/.exec(message.Text)?.[0];
      if (code !== undefined) return code;
    }
    if (Date.now() > deadline) throw new Error(`No code for ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Types `email`, sends a code, reads it from the mail catcher and types it, until `then` (the
 * username's question for an account without one, else the Friends tab it lands on, ADR 0081)
 * shows.
 */
export async function signInWith(page: Page, email: string, then = 'Friends'): Promise<void> {
  const before = await mailCount(email);
  await forgetNetworkCodes();
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  await page.getByLabel('The code').fill(await codeFor(email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: then, exact: true }).waitFor();
}

/**
 * A fresh phone (iPhone Safari's visible size) signed in to a new account named `username`, with
 * that username, left on its account screen. Its console errors go to `errors`. `blocked`: its
 * Realtime socket never connects, so it polls as before (ADR 0082).
 */
export async function signedInPhone(
  browser: Browser,
  base: string,
  username: string,
  errors: string[],
  blocked = false,
): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE });
  await allowLocalRealtime(context, base);
  if (blocked) await blockRealtime(context);
  const page = await context.newPage();
  watchPage(page);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${base}/?view=signin`);
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
  await signInWith(page, `${username.toLowerCase()}@example.com`, 'Choose a username');
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Save' }).click();
  // Signed in with a username: the Friends tab, its lists read (ADR 0081).
  await page.getByRole('heading', { name: 'Friends', exact: true }).waitFor();
  await page.locator('.friends-code-value').waitFor();
  return page;
}

/** Makes two signed-in accounts friends through their Friends tabs: `one` asks, `two` accepts. */
export async function befriend(
  base: string,
  one: Page,
  two: Page,
  twoName: string,
  oneName: string,
): Promise<void> {
  const friendsOf = (page: Page) => page.locator('.friends');
  await one.getByLabel('Add a friend').fill(twoName);
  await friendsOf(one).getByRole('button', { name: 'Add', exact: true }).click();
  await friendsOf(one).getByText(`Request sent to ${twoName}.`).waitFor();
  await two.goto(`${base}/?view=friends`);
  await friendsOf(two)
    .getByRole('button', { name: `Accept ${oneName}` })
    .click();
  await friendsOf(two)
    .locator('.friends-group[data-group="friends"] .friends-name', { hasText: oneName })
    .waitFor();
}
