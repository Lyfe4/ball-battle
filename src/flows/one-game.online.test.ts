// One game at a time, through the real page (ADR 0089 addendum of 2026-11-27, the setup phase): Jo
// accepted Sam's challenge and both are choosing lineups. Sam goes to Play another way: by typing
// the URL on the phone, by the tab bar, and by the rail on a desktop. Play shows "Back to your
// lineup" from its first frame, never a Play to press (a sampler on every frame watches). Friends
// and "Who do you want to play?" offer no new challenge, only "You're in a game with Jo" and Back
// to it, Jo's row saying "In a game with you". Every send is refused by the server whatever the
// page shows (`in_a_match`), and a stale tab's send says why. Jo's lineup never changes meanwhile.
// `netlify dev` serving an online build with accounts; Chromium only.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { befriend, signedInPhone } from './account-support.ts';
import { friendHow, sendChallenge } from './live-support.ts';
import { socketOf, watchPage } from './realtime-support.ts';

const BASE = process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888';
const DESKTOP = { width: 1280, height: 800 };

let browser: Browser;
const errors: string[] = [];

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
  await browser.close();
});

/**
 * On every frame from the page's first, notes whether Play (the box and its button) showed as
 * something to press: on screen, not waiting, not inert. Installed before any page script runs
 * (as source: this file runs in node, the script in the page).
 */
const SAMPLE_PLAY = `
  window.playOffered = false;
  const look = () => {
    const home = document.getElementById('home');
    const row = document.querySelector('.home-play-row');
    if (home && row && !home.hidden && !row.inert) {
      const style = getComputedStyle(row);
      if (style.display !== 'none' && style.visibility !== 'hidden' && row.getClientRects().length)
        window.playOffered = true;
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
`;

const offered = (page: Page) => page.evaluate('window.playOffered');
const backToLineup = (page: Page) =>
  page.getByRole('button', { name: /^Back to your lineup/ }).waitFor();
const lineupShown = (page: Page) => page.locator('#online-lineup .lineup-step:visible').waitFor();

/** A send straight to the API from `page`, as any page (stale or forged) could: its status and code. */
const sendFrom = (page: Page, body: Record<string, unknown>) =>
  page.evaluate(async (payload) => {
    const answer = await fetch('/api/v1/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'reveal',
        bestOf: 3,
        requestId: crypto.randomUUID(),
        ...payload,
      }),
    });
    const json = (await answer.json().catch(() => ({}))) as { error?: { code?: string } };
    return { status: answer.status, code: json.error?.code };
  }, body);

describe('one game at a time', () => {
  it(
    'in the lineups, Play is the way back from its first frame and nothing new can start',
    { timeout: 240_000 },
    async () => {
      const stem = crypto.randomUUID().slice(0, 6);
      const sam = `Sam_${stem}`;
      const jo = `Jo_${stem}`;
      const one = await signedInPhone(browser, BASE, sam, errors);
      const two = await signedInPhone(browser, BASE, jo, errors);
      await befriend(BASE, one, two, jo, sam);
      await two.goto(BASE);
      await socketOf(two).waitUp();
      const samContext = one.context();
      await samContext.addInitScript({ content: SAMPLE_PLAY });

      // A second tab of Sam's opens "Who do you want to play?" before the match and picks the link.
      const stale = await samContext.newPage();
      watchPage(stale);
      await friendHow(stale, BASE, 'Live');
      await stale.locator('.home-play-row .home-play').click();
      const staleSheet = stale.getByRole('dialog', { name: 'Who do you want to play?' });
      await staleSheet.getByRole('radio', { name: /^Send a link instead/ }).click();

      // Sam challenges Jo from Friends; Jo accepts: both choose lineups.
      await one.goto(`${BASE}/?view=friends`);
      await one.getByRole('button', { name: `Challenge ${jo}` }).click();
      await sendChallenge(one, `Waiting for ${jo}`);
      await two
        .getByRole('region', { name: 'Challenge' })
        .getByRole('button', { name: 'Accept' })
        .click();
      await lineupShown(two);
      await lineupShown(one);
      const lineupUrl = one.url();
      const joUrl = two.url();

      // By typing the URL: a fresh page load, Play never offered.
      await one.goto(BASE);
      await backToLineup(one);
      expect(await offered(one)).toBe(false);
      // Back to the lineup leads there; then Friends, and Play by the tab bar (a lineup has none).
      await one.getByRole('button', { name: /^Back to your lineup/ }).click();
      await lineupShown(one);
      await one.goto(`${BASE}/?view=friends`);
      await one.locator('.friends-link-card').getByRole('button', { name: 'Back to it' }).waitFor();
      await one.locator('.tab-bar-tab[data-tab="play"]:visible').click();
      await backToLineup(one);
      expect(await offered(one)).toBe(false);
      // And the browser's Back from the lineup.
      await one.goto(lineupUrl);
      await lineupShown(one);
      await one.goBack();
      await backToLineup(one);
      expect(await offered(one)).toBe(false);

      // On a desktop, by the rail.
      const desk = await samContext.newPage();
      watchPage(desk);
      await desk.setViewportSize(DESKTOP);
      await desk.goto(lineupUrl);
      await lineupShown(desk);
      await desk.locator('.tab-bar-tab[data-tab="play"]:visible').click();
      await backToLineup(desk);
      expect(await offered(desk)).toBe(false);

      // Friends offers no new challenge: one line and Back to it; Jo is in a game with Sam.
      await desk.locator('.tab-bar-tab[data-tab="friends"]:visible').click();
      const card = desk.locator('.friends-link-card');
      await card.getByRole('heading', { name: `You’re in a game with ${jo}` }).waitFor();
      await card.getByRole('button', { name: 'Back to it' }).waitFor();
      await desk.locator('.friends-row', { hasText: 'In a game with you' }).waitFor();
      expect(await desk.getByRole('button', { name: /^Challenge/ }).count()).toBe(0);

      // Every send is refused by the server, whatever the page shows.
      const inbox = await desk.evaluate(async () => {
        const answer = await fetch('/api/v1/me/inbox');
        return (await answer.json()) as { friends: { id: string }[] };
      });
      const friendship = inbox.friends[0]?.id;
      for (const body of [{ live: true, friend: friendship }, { live: true }]) {
        expect(await sendFrom(desk, body)).toStrictEqual({ status: 409, code: 'in_a_match' });
      }
      // The stale tab's Send a link: refused, and it says why above the button.
      await staleSheet.locator('.who-sheet-send').click();
      await staleSheet
        .locator('.who-sheet-failure')
        .getByText('You’re in a match already', { exact: false })
        .waitFor();

      // Back to it leads to the lineup.
      await card.getByRole('button', { name: 'Back to it' }).click();
      await lineupShown(desk);

      // Jo's screen never changed: the same lineup, no challenge on it.
      expect(two.url()).toBe(joUrl);
      await lineupShown(two);
      expect(await two.getByRole('region', { name: 'Challenge' }).count()).toBe(0);
      expect(errors.filter((line) => !line.includes('409'))).toStrictEqual([]);
      for (const page of [one, two]) await page.context().close();
    },
  );
});
