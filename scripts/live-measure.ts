// Measures live friend matches (ADR 0053) on a deployed online build: two phones (browser contexts
// at 390 x 664 on this one machine, so one clock) play a match and this prints what it measured as
// JSON. Not a test: the page carries no instrumentation, so everything is read from outside it.
//   node scripts/live-measure.ts <base url> <bo3|bo5|disconnect> [--slow] [--shots <dir>]
// bo3/bo5: the lobby, a whole match with picks after 3-12 s (the friend lets their first pick run
// out), how far apart the two screens start each fight (when each page's countdown card lifts),
// how long a pick takes to reach the other screen (the first read there with the new version),
// the requests both pages made and how long a read takes.
// disconnect: the friend drops for 12 s and comes back, then drops for good (a forfeit).
// --slow: the friend's connection gets 150 ms more each way.
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const [base = 'http://localhost:8888', mode = 'bo3', ...rest] = process.argv.slice(2);
const slow = rest.includes('--slow');
const shotsAt = rest.indexOf('--shots');
const shots = shotsAt >= 0 ? rest[shotsAt + 1] : undefined;
if (shots !== undefined) mkdirSync(shots, { recursive: true });
const bestOf = mode === 'bo5' ? 5 : 3;

interface Phone {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly requests: { route: string; status: number; ms: number; at: number }[];
  /** Each new series version this page was answered, and when. */
  readonly versions: { version: number; at: number }[];
  /** Each server clock sample: device times and X-Now. */
  readonly clock: { sent: number; received: number; server: number }[];
  /** When this page's live countdown card lifted (a fight started), by this machine's clock. */
  starts(): Promise<number[]>;
}

async function phone(browser: Browser, name: string): Promise<Phone> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  // Netlify's deploy toolbar covers the page's buttons; each fight's start is noted as it happens.
  await page.addInitScript(`
    window.__starts = [];
    new MutationObserver(() => {
      document.querySelector('[data-netlify-deploy-id]')?.remove();
      const layer = document.querySelector('.ready-layer');
      const count = document.querySelector('.ready-count');
      const held = layer !== null && !layer.hidden && count !== null && !count.hidden;
      if (window.__held && !held) window.__starts.push(Date.now());
      window.__held = held;
    }).observe(document, { childList: true, subtree: true, attributes: true });
  `);
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
  if (slow && name === 'friend') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 300,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
  return {
    page,
    context,
    requests,
    versions,
    clock,
    starts: () => page.evaluate(() => (globalThis as unknown as { __starts: number[] }).__starts),
  };
}

const shot = async (page: Page, name: string) => {
  if (shots !== undefined) await page.screenshot({ path: `${shots}/${name}.png` });
};

async function lineup(page: Page, done: string, first: number): Promise<void> {
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < bestOf; index += 1) await grid.nth(first + index).click();
  await page.getByRole('button', { name: done }).click();
}

async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

async function start(browser: Browser) {
  const sender = await phone(browser, 'sender');
  const friend = await phone(browser, 'friend');
  await sender.page.goto(`${base}/`);
  await shot(sender.page, 'home-no-match');
  await sender.page.goto(`${base}/?view=send&fmt=reveal&mode=bo${String(bestOf)}`);
  await lineup(sender.page, 'Send challenge', 0);
  await confirmAge(sender.page);
  await sender.page.getByRole('heading', { name: 'Waiting for your friend…' }).waitFor();
  await shot(sender.page, 'lobby');
  const token = new URL(sender.page.url()).searchParams.get('challenge') ?? '';
  await friend.page.goto(`${base}/?challenge=${token}`);
  await friend.page.getByRole('button', { name: 'Build your lineup' }).click();
  await lineup(friend.page, 'Accept challenge', bestOf);
  await confirmAge(friend.page);
  const accepted = Date.now();
  await friend.page.waitForURL(/[?&]online=/);
  await sender.page.waitForURL(/[?&]online=/, { timeout: 30_000 });
  return { sender, friend, lobbyToMatchMs: Date.now() - accepted };
}

/** Picks on one page: `delay(n)` ms after its nth pick phase opens, or never (it runs out). */
async function player(phone: Phone, delay: (n: number) => number | undefined, picks: number[]) {
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
    const pick = panel.locator('.pick-row-pick').first();
    const open = await pick.isVisible().catch(() => false);
    if (open && due === undefined) {
      const wait = delay(phases);
      phases += 1;
      due = wait === undefined ? Infinity : Date.now() + wait;
    }
    if (!open) due = undefined;
    if (due !== undefined && Date.now() >= due) {
      picks.push(Date.now());
      await pick.click().catch(() => undefined);
      due = Infinity;
    }
    await phone.page.waitForTimeout(200);
  }
}

const pct = (list: readonly number[], p: number) => {
  const sorted = [...list].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

/** The page's own clock estimate: the shortest round trip of all its answers (live-clock.ts). */
function offsetOf(clock: Phone['clock']): number | undefined {
  const best = [...clock].sort((x, y) => x.received - x.sent - (y.received - y.sent))[0];
  return best === undefined ? undefined : Math.round(best.server - (best.sent + best.received) / 2);
}

/** When the other page first had a version newer than the one it had when the pick was sent. */
function reached(picks: readonly number[], other: Phone): number[] {
  return picks.flatMap((at) => {
    const before = other.versions.filter((v) => v.at <= at).at(-1)?.version ?? -1;
    const next = other.versions.find((v) => v.version > before && v.at >= at);
    return next === undefined ? [] : [next.at - at];
  });
}

const browser = await chromium.launch();
try {
  const begun = Date.now();
  const { sender, friend, lobbyToMatchMs } = await start(browser);
  if (mode === 'disconnect') {
    await sender.page.waitForTimeout(5_000);
    await friend.context.setOffline(true);
    const dropped = Date.now();
    await sender.page
      .getByText(/disconnected · /)
      .first()
      .waitFor({ timeout: 30_000 });
    const noticeAfterMs = Date.now() - dropped;
    await shot(sender.page, 'disconnected');
    await sender.page.waitForTimeout(Math.max(0, 12_000 - noticeAfterMs));
    await friend.context.setOffline(false);
    const back = Date.now();
    await sender.page
      .getByText(/disconnected · /)
      .first()
      .waitFor({ state: 'detached', timeout: 30_000 })
      .catch(() => undefined);
    const noticeGoneAfterMs = Date.now() - back;
    const stillOpen = !(await sender.page.locator('#online-series .series-result').isVisible());
    await sender.page.goto(`${base}/`);
    await sender.page.getByRole('button', { name: /^Back to your match/ }).waitFor();
    await shot(sender.page, 'home-match');
    await sender.page.getByRole('button', { name: /^Back to your match/ }).click();
    await friend.context.setOffline(true);
    const gone = Date.now();
    await sender.page.locator('#online-series .series-result').waitFor({ timeout: 90_000 });
    await shot(sender.page, 'forfeit');
    console.log(
      JSON.stringify(
        {
          mode,
          lobbyToMatchMs,
          noticeAfterMs,
          noticeGoneAfterMs,
          stillOpenAfterReturn: stillOpen,
          forfeitShownAfterMs: Date.now() - gone,
          note: await sender.page.locator('#online-series .series-note').innerText(),
        },
        null,
        2,
      ),
    );
  } else {
    const picks = { sender: [] as number[], friend: [] as number[] };
    const wait = () => 3_000 + Math.random() * 9_000;
    let autoSeenAt: number | undefined;
    await Promise.all([
      player(sender, wait, picks.sender),
      player(friend, (n) => (n === 0 ? undefined : wait()), picks.friend),
      (async () => {
        await friend.page
          .locator('#online-series .series-note', { hasText: /random ball/ })
          .waitFor({ timeout: 120_000 })
          .catch(() => undefined);
        autoSeenAt = Date.now();
        await shot(friend.page, 'auto-pick');
      })(),
    ]);
    await shot(sender.page, 'result');
    const [a, b] = [await sender.starts(), await friend.starts()];
    const gaps = a.flatMap((at) => {
      const near = b.reduce(
        (best, x) => (Math.abs(x - at) < Math.abs(best - at) ? x : best),
        Infinity,
      );
      return Math.abs(near - at) < 5_000 ? [Math.abs(near - at)] : [];
    });
    const reads = [...sender.requests, ...friend.requests]
      .filter((r) => r.route === 'GET /api/v1/series/:id')
      .map((r) => r.ms);
    const delays = [...reached(picks.sender, friend), ...reached(picks.friend, sender)];
    const byRoute: Record<string, number> = {};
    for (const r of [...sender.requests, ...friend.requests]) {
      const key = `${r.route} ${String(r.status)}`;
      byRoute[key] = (byRoute[key] ?? 0) + 1;
    }
    console.log(
      JSON.stringify(
        {
          mode,
          slow,
          seconds: Math.round((Date.now() - begun) / 1000),
          lobbyToMatchMs,
          sawRandomPick: autoSeenAt !== undefined,
          fights: { sender: a.length, friend: b.length },
          fightStartGapsMs: gaps,
          pickToOtherScreenMs: delays,
          clockOffsetsMs: { sender: offsetOf(sender.clock), friend: offsetOf(friend.clock) },
          requests: {
            sender: sender.requests.length,
            friend: friend.requests.length,
            total: sender.requests.length + friend.requests.length,
          },
          byRoute,
          seriesReadMs: { p50: pct(reads, 0.5), p90: pct(reads, 0.9), max: pct(reads, 1) },
        },
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
