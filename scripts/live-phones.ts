// Two phones playing a live friend match (ADR 0053) through the real page, for the measuring
// scripts (live-measure.ts, live-countdown.ts): browser contexts at 390 x 664 on this one machine
// (so one clock), each noting its API answers, its clock samples and every moment its live
// countdown card changed. Not a test: the page carries no instrumentation; everything is read from
// outside it.
import type { Browser, BrowserContext, Page } from 'playwright';

export interface PhoneOptions {
  /** 150 ms more each way on this phone's connection. */
  readonly slow?: boolean | undefined;
  /** Chromium CPU throttling (4 is a mid phone, 6 a slow one). */
  readonly cpu?: number | undefined;
  /** Frames capped at this rate (30: a phone in Low Power Mode). */
  readonly fps?: number | undefined;
}

/** One change of a live countdown card: shown or not, and its line. */
export interface CardMoment {
  readonly at: number;
  readonly held: boolean;
  readonly text: string;
}

export interface Phone {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly requests: { route: string; status: number; ms: number; at: number }[];
  /** Each new series version this page was answered, and when. */
  readonly versions: { version: number; at: number }[];
  /** Each server clock sample: device times and X-Now. */
  readonly clock: { sent: number; received: number; server: number }[];
  /** When this page's live countdown card lifted (a fight started), by this machine's clock. */
  starts(): Promise<number[]>;
  /** Every change of the countdown card, in order. */
  card(): Promise<CardMoment[]>;
}

/** Notes the countdown card's changes; caps the frame rate when asked (`__fps`). */
const PROBE = `
  window.__starts = [];
  window.__card = [];
  const note = () => {
    document.querySelector('[data-netlify-deploy-id]')?.remove();
    const layer = document.querySelector('.ready-layer');
    const count = document.querySelector('.ready-count');
    const held = layer !== null && !layer.hidden && count !== null && !count.hidden;
    const text = held ? (count.textContent ?? '') : '';
    if (window.__held && !held) window.__starts.push(Date.now());
    const last = window.__card[window.__card.length - 1];
    if (last === undefined ? held : last.held !== held || last.text !== text) {
      window.__card.push({ at: Date.now(), held, text });
    }
    window.__held = held;
  };
  new MutationObserver(note).observe(document, {
    childList: true, subtree: true, attributes: true, characterData: true,
  });
  if (window.__fps) {
    const native = window.requestAnimationFrame.bind(window);
    const gap = 1000 / window.__fps;
    let next = 0;
    window.requestAnimationFrame = (callback) => native(function wait(now) {
      if (now + 1 < next) return native(wait);
      next = Math.max(next + gap, now);
      callback(now);
    });
  }
`;

export async function phone(
  browser: Browser,
  name: string,
  options: PhoneOptions = {},
): Promise<Phone> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  if (options.fps !== undefined) await page.addInitScript(`window.__fps = ${String(options.fps)};`);
  await page.addInitScript(PROBE);
  const requests: Phone['requests'] = [];
  const versions: Phone['versions'] = [];
  const clock: Phone['clock'] = [];
  const sent = new Map<object, number>();
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) sent.set(request, Date.now());
  });
  page.on('response', (response) => {
    const request = response.request();
    if (!request.url().includes('/api/v1/')) return;
    const at = sent.get(request) ?? Date.now();
    const now = Date.now();
    const route = `${request.method()} ${new URL(request.url()).pathname.replace(/[0-9a-f-]{36}|[A-Za-z0-9_-]{22}/g, ':id')}`;
    requests.push({ route, status: response.status(), ms: now - at, at });
    const server = Number(response.headers()['x-now']);
    if (Number.isFinite(server)) clock.push({ sent: at, received: now, server });
    const version = /"v(\d+)/.exec(response.headers()['etag'] ?? '')?.[1];
    if (version !== undefined && response.status() === 200) {
      const v = Number(version);
      if (!versions.some((seen) => seen.version >= v)) versions.push({ version: v, at: now });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[${name}] ${message.text()}`);
  });
  if (options.slow === true || options.cpu !== undefined) {
    const cdp = await context.newCDPSession(page);
    if (options.slow === true) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 300,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    }
    if (options.cpu !== undefined) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpu });
    }
  }
  return {
    page,
    context,
    requests,
    versions,
    clock,
    starts: () => page.evaluate(() => (globalThis as unknown as { __starts: number[] }).__starts),
    card: () => page.evaluate(() => (globalThis as unknown as { __card: CardMoment[] }).__card),
  };
}

export async function lineup(page: Page, done: string, first: number, count: number) {
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < count; index += 1) await grid.nth(first + index).click();
  await page.getByRole('button', { name: done }).click();
}

async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

/**
 * The sender sends a live Reveal challenge from home's vs Friend (the 16+ question first, ADR
 * 0055), the friend accepts it, and both reach the match.
 */
export async function startMatch(
  base: string,
  bestOf: 3 | 5,
  sender: Phone,
  friend: Phone,
  shot: (page: Page, name: string) => Promise<void> = () => Promise.resolve(),
): Promise<{ lobbyToMatchMs: number }> {
  await sender.page.goto(`${base}/`);
  await shot(sender.page, 'home-no-match');
  await sender.page.locator('.home-chooser button[data-opponent="friend"]').click();
  await sender.page.locator('.home-play-row .home-play').click();
  await confirmAge(sender.page);
  await sender.page.getByRole('heading', { name: 'vs Friend' }).waitFor();
  await sender.page.getByRole('button', { name: `Best of ${String(bestOf)}` }).click();
  await sender.page.getByRole('button', { name: 'Choose lineup' }).click();
  await lineup(sender.page, 'Send challenge', 0, bestOf);
  await sender.page.getByRole('heading', { name: 'Waiting for your friend' }).waitFor();
  await shot(sender.page, 'lobby');
  const token = new URL(sender.page.url()).searchParams.get('challenge') ?? '';
  await friend.page.goto(`${base}/?challenge=${token}`);
  await friend.page.getByRole('button', { name: 'Build your lineup' }).click();
  await confirmAge(friend.page);
  await lineup(friend.page, 'Accept challenge', bestOf, bestOf);
  const accepted = Date.now();
  await friend.page.waitForURL(/[?&]online=/);
  await sender.page.waitForURL(/[?&]online=/, { timeout: 30_000 });
  return { lobbyToMatchMs: Date.now() - accepted };
}

/** Picks on one page: `delay(n)` ms after its nth pick phase opens, or never (it runs out). */
export async function player(
  phone: Phone,
  delay: (n: number) => number | undefined,
  picks: number[],
) {
  const panel = phone.page.locator('#online-series');
  let phases = 0;
  let due: number | undefined;
  for (;;) {
    if (
      await panel
        .locator('.series-result')
        .isVisible()
        .catch(() => false)
    )
      return;
    // The row seen now, tapped as it is: a locator's click would wait for the next pick's rows if
    // this one went first, and tap one of those (live-support.ts, pickIfDue).
    const pick = await phone.page.$('#online-series .pick-row-pick');
    const open = pick !== null && (await pick.isVisible().catch(() => false));
    if (open && due === undefined) {
      const wait = delay(phases);
      phases += 1;
      due = wait === undefined ? Infinity : Date.now() + wait;
    }
    if (!open) due = undefined;
    if (pick !== null && due !== undefined && Date.now() >= due) {
      picks.push(Date.now());
      await pick.click().catch(() => undefined);
      due = Infinity;
    }
    await phone.page.waitForTimeout(200);
  }
}

export const pct = (list: readonly number[], p: number) => {
  const sorted = [...list].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
