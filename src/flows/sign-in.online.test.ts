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

/** Types `email`, sends a code, reads it from the mail catcher and types it. */
async function signInWith(page: Page, email: string): Promise<void> {
  const before = await mailCount(email);
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  await page.getByLabel('The code').fill(await codeFor(email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'You’re signed in' }).waitFor();
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
    await signInWith(first, email);
    expect(await me(first)).toStrictEqual({ name: guest.name, account: true });

    const second = await phone();
    await second.goto(`${BASE}/?view=signin`);
    await second.getByRole('button', { name: 'I’m 16 or older' }).click();
    await signInWith(second, email);
    expect(await me(second)).toStrictEqual({ name: guest.name, account: true });
  });
});
