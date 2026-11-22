// Signing in with an email code through the real page (ADR 0079): `netlify dev` serving an online
// build with accounts, the API against the local Supabase, and the codes read from its mail
// catcher. A phone's guest adds an email and stays the same player; a second phone (no guest)
// answers the 16+ question and signs in to that same player. iPhone Safari's visible size,
// Chromium only, like the friend challenge.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://127.0.0.1:54324';
const PHONE = { width: 390, height: 664 };

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  const options = await fetch(`${BASE}/api/v1/auth/options`).catch(() => undefined);
  if (options?.ok !== true) {
    throw new Error(
      `No accounts at ${BASE}: BALLBATTLE_ACCOUNTS=1, pnpm build:online, netlify dev`,
    );
  }
  browser = await chromium.launch();
});

afterAll(async () => {
  for (const context of contexts) await context.close();
  await browser.close();
});

async function phone(): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE });
  contexts.push(context);
  return context.newPage();
}

/** How many emails `email` has had. */
async function mailCount(email: string): Promise<number> {
  const query = encodeURIComponent(`to:"${email}"`);
  const body = (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()) as {
    messages?: { ID: string }[];
  };
  return body.messages?.length ?? 0;
}

/** The code in `email`'s newest email, once there are more than `before`. */
async function codeFor(email: string, before: number): Promise<string> {
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

const me = (page: Page) => page.evaluate(async () => (await fetch('/api/v1/me')).json());

/**
 * Types `email`, sends a code, reads it from the mail catcher and types it, until `then` (the
 * username's question for an account without one, else signed in) shows.
 */
async function signInWith(page: Page, email: string, then = 'You’re signed in'): Promise<void> {
  const before = await mailCount(email);
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  await page.getByLabel('The code').fill(await codeFor(email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: then }).waitFor();
}

/** Opens home's settings and presses `name` in its Online group. */
async function inSettings(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.getByRole('button', { name, exact: true }).click();
}

/**
 * Presses `press` and waits for the page to start afresh on home, signed out, with nothing of the
 * player left here.
 */
async function signsOut(page: Page, press: () => Promise<void>): Promise<void> {
  const reloaded = page.waitForEvent('load');
  await press();
  await reloaded;
  expect(page.url()).toBe(`${BASE}/`);
  expect(await page.evaluate(async () => (await fetch('/api/v1/me')).status)).toBe(401);
  expect(await page.evaluate(() => Object.keys(localStorage))).toStrictEqual([]);
}

describe('signing in with an email code', () => {
  it('keeps a guest the same player, on this phone and the next', { timeout: 90_000 }, async () => {
    const email = `phone-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const first = await phone();
    await first.goto(BASE);
    // A guest, as the first online action makes one.
    await first.evaluate(async () => {
      await fetch('/api/v1/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adult: true }),
      });
      localStorage.setItem('ballbattle.online.guest', '1');
    });
    const guest = (await me(first)) as { name: string };
    await first.goto(`${BASE}/?view=signin`);
    await signInWith(first, email, 'Choose a username');
    expect(await me(first)).toStrictEqual({ name: guest.name, account: true, username: null });

    // The server alone checks a name, and says why not under the field.
    await first.getByLabel('Username').fill('sh1t_head');
    await first.getByRole('button', { name: 'Save' }).click();
    await first.getByText('That name isn’t allowed: choose another').waitFor();
    const username = `Sam_${crypto.randomUUID().slice(0, 8)}`;
    await first.getByLabel('Username').fill(username);
    await first.getByRole('button', { name: 'Save' }).click();
    await first.getByText(`Opponents see you as ${username}.`).waitFor();
    expect(await me(first)).toStrictEqual({ name: username, account: true, username });

    const second = await phone();
    await second.goto(`${BASE}/?view=signin`);
    await second.getByRole('button', { name: 'I’m 16 or older' }).click();
    await signInWith(second, email);
    expect(await me(second)).toStrictEqual({ name: username, account: true, username });

    // Log out, then back in: the account and its username are still there.
    await second.goto(BASE);
    await signsOut(second, () => inSettings(second, 'Log out'));
    await second.goto(`${BASE}/?view=signin`);
    await second.getByRole('button', { name: 'I’m 16 or older' }).click();
    await signInWith(second, email);
    await second.getByText(`Opponents see you as ${username}.`).waitFor();

    // Delete account: gone, on this phone and the other.
    await second.goto(BASE);
    await inSettings(second, 'Delete account');
    await signsOut(second, () =>
      second.getByRole('button', { name: 'Delete', exact: true }).click(),
    );
    expect(await first.evaluate(async () => (await fetch('/api/v1/me')).status)).toBe(401);
  });
});
