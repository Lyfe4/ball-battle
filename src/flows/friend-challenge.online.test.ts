// A friend challenge played by two people, end to end (ADR 0052): two phones (two browser contexts,
// so two guests) against the real page and API on one origin, `netlify dev` serving an online
// build (`pnpm build:online`) over a local Supabase. Chromium only. The server's seeds come from
// the series' random id, so the fights differ run to run: the flow plays whatever is on screen
// (a pick, Play round, a replay after a draw) until both players see the result and fair play.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
/** Two phones, iPhone Safari's visible size (ADR 0039). */
const PHONE = { width: 390, height: 664 };

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/v1/health`).catch(() => undefined);
  if (health?.ok !== true) {
    throw new Error(`No online server at ${BASE}: pnpm build:online, then netlify dev`);
  }
  browser = await chromium.launch();
});

afterAll(async () => {
  for (const context of contexts) await context.close();
  await browser.close();
});

/** A fresh phone, collecting every console error (a CSP violation is one). */
async function phone(errors: string[]): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE });
  contexts.push(context);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return page;
}

/** Fills the visible lineup tray with the first three balls of the grid, then presses `done`. */
async function buildLineup(page: Page, done: string): Promise<void> {
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < 3; index += 1) await grid.nth(index).click();
  await page.getByRole('button', { name: done }).click();
}

/** The 16+ card, when it shows: the first online action on this device. */
async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

/** One step of whatever the series screen offers; true once the result is up. */
async function step(page: Page): Promise<boolean> {
  const panel = page.locator('#online-series');
  if (await panel.locator('.series-result').isVisible()) return true;
  const pick = panel.locator('.pick-row-pick').first();
  if (await pick.isVisible()) {
    await pick.click();
    return false;
  }
  const play = panel.getByRole('button', { name: /Play round|Replay round/ });
  if (await play.isVisible()) {
    await play.click();
    // A pairing new to this device waits on its ready card's Fight! (ADR 0036).
    const fight = page.getByRole('button', { name: 'Fight!' });
    await fight.click({ timeout: 3000 }).catch(() => undefined);
    // The round plays out on the arena; the panel moves on once it has.
    await page
      .locator('#online-series[data-phase="playing"]')
      .waitFor({ state: 'detached', timeout: 120_000 });
    return false;
  }
  // Waiting on the other player: the page asks the server again by itself.
  await page.waitForTimeout(1000);
  return false;
}

describe('a friend challenge', () => {
  it(
    'is sent, accepted and played to the end by two players, each seeing fair play',
    { timeout: 600_000 },
    async () => {
      const errors: string[] = [];
      const sender = await phone(errors);
      const friend = await phone(errors);

      // The sender: Other modes' Online section, a Reveal challenge, a lineup, the 16+ card.
      await sender.goto(`${BASE}/?view=modes`);
      await sender.getByRole('heading', { name: 'Online' }).waitFor();
      await sender.goto(`${BASE}/?view=send&fmt=reveal&mode=bo3`);
      await buildLineup(sender, 'Send challenge');
      await confirmAge(sender);
      await sender.getByRole('heading', { name: 'Send this link to a friend' }).waitFor();
      const token = new URL(sender.url()).searchParams.get('challenge') ?? '';
      expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);

      // The friend: the link's card names the sender and what it is, never their lineup.
      await friend.goto(`${BASE}/?challenge=${token}`);
      await friend.getByRole('heading', { name: /challenges you$/ }).waitFor();
      await expect(friend.locator('#online-challenge').innerText()).resolves.toContain(
        'Best of 3 · Reveal',
      );
      await friend.getByRole('button', { name: 'Build your lineup' }).click();
      await buildLineup(friend, 'Accept challenge');
      await confirmAge(friend);
      await friend.waitForURL(/[?&]online=/);
      const series = new URL(friend.url()).searchParams.get('online') ?? '';

      // The sender finds it on home, their turn or not.
      await sender.goto(`${BASE}/`);
      await sender.getByRole('heading', { name: /Your turn \(1\)|Online series/ }).waitFor();
      await sender.goto(`${BASE}/?online=${series}`);

      // Both play until both see the result.
      const done = { sender: false, friend: false };
      for (let turn = 0; !(done.sender && done.friend); turn += 1) {
        expect(turn, 'the series never ended').toBeLessThan(400);
        if (!done.sender) done.sender = await step(sender);
        if (!done.friend) done.friend = await step(friend);
      }
      for (const page of [sender, friend]) {
        await page.locator('#online-series .fair-play[data-result="fair"]').waitFor();
      }
      const results = await Promise.all(
        [sender, friend].map((page) => page.locator('#online-series .series-result').innerText()),
      );
      // One wins, the other sees the winner named.
      expect(results.filter((text) => text === 'You win')).toHaveLength(1);
      expect(errors).toStrictEqual([]);
    },
  );
});
