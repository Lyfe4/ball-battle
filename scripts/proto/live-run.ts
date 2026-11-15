// PROTOTYPE (proto/live-friend-matches, ADR 0053 draft): two phones play a live friend match and
// measure it. Not a test: it prints what it measured as JSON and saves screenshots.
//   node scripts/proto/live-run.ts <base url> <bo3|bo5|disconnect> [--slow] [--shots <dir>]
// bo3/bo5: the lobby, a whole live series with picks after 3-12 s (the friend lets one pick run
// out), how far apart the two screens start each fight, pick-to-update delays, and requests.
// disconnect: the friend drops for 15 s (and comes back), then for good (forfeit).
// --slow: the friend's connection gets 150 ms more each way (a phone on a worse network).
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const [base = 'http://localhost:8888', mode = 'bo3', ...rest] = process.argv.slice(2);
const slow = rest.includes('--slow');
const shotsAt = rest.indexOf('--shots');
const shots = shotsAt >= 0 ? rest[shotsAt + 1] : undefined;
const PHONE = { width: 390, height: 664 };
const bestOf = mode === 'bo5' ? 5 : 3;

interface Counted {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly requests: { url: string; status: number; ms: number; at: number }[];
}

async function phone(browser: Browser, name: string): Promise<Counted> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const requests: Counted['requests'] = [];
  const started = new Map<string, number>();
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) started.set(r.url() + r.method(), Date.now());
  });
  page.on('requestfinished', async (r) => {
    if (!r.url().includes('/api/v1/')) return;
    const response = await r.response();
    const begun = started.get(r.url() + r.method()) ?? Date.now();
    requests.push({
      url: `${r.method()} ${new URL(r.url()).pathname}`,
      status: response?.status() ?? 0,
      ms: Date.now() - begun,
      at: begun,
    });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`[${name}] ${m.text()}`);
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
  return { page, context, requests };
}

async function buildLineup(page: Page, done: string, start: number): Promise<void> {
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < bestOf; index += 1) await grid.nth(start + index).click();
  await page.getByRole('button', { name: done }).click();
}

async function confirmAge(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

const shot = async (page: Page, name: string) => {
  if (shots !== undefined) await page.screenshot({ path: `${shots}/${name}.png` });
};
const note = (page: Page) =>
  page
    .locator('#online-series')
    .innerText()
    .catch(() => '');

/** Plays picks on one page: after `delay(round)` ms, or never (to let it run out). */
async function player(
  page: Page,
  delay: (round: number) => number | undefined,
  onPickPhase?: (round: number) => Promise<void>,
): Promise<void> {
  const planned = new Map<string, number>();
  for (;;) {
    const panel = page.locator('#online-series');
    if (
      await panel
        .locator('.series-result')
        .isVisible()
        .catch(() => false)
    )
      return;
    const text = await note(page);
    if (text.includes('Your pick')) {
      const round = await page.evaluate(() => {
        const live = (globalThis as { __live?: { picks: unknown[] } }).__live;
        return live?.picks.length ?? 0;
      });
      const key = text.replace(/\d+ s/g, '');
      if (!planned.has(key)) {
        const wait = delay(round);
        planned.set(key, wait === undefined ? Infinity : Date.now() + wait);
        if (onPickPhase !== undefined) await onPickPhase(round);
      }
      const at = planned.get(key) ?? Infinity;
      const pick = panel.locator('.pick-row-pick').first();
      if (Date.now() >= at && (await pick.isVisible().catch(() => false))) {
        await pick.click().catch(() => undefined);
        planned.set(key, Infinity);
      }
    }
    await page.waitForTimeout(250);
  }
}

async function start(browser: Browser) {
  const sender = await phone(browser, 'sender');
  const friend = await phone(browser, 'friend');
  await sender.page.goto(`${base}/?view=send&fmt=reveal&mode=${bestOf === 5 ? 'bo5' : 'bo3'}`);
  await buildLineup(sender.page, 'Send challenge', 0);
  await confirmAge(sender.page);
  await sender.page.getByRole('heading', { name: 'Waiting for your friend…' }).waitFor();
  await shot(sender.page, 'lobby');
  const token = new URL(sender.page.url()).searchParams.get('challenge') ?? '';
  await friend.page.goto(`${base}/?challenge=${token}`);
  await friend.page.getByRole('button', { name: 'Build your lineup' }).click();
  await buildLineup(friend.page, 'Accept challenge', 3);
  await confirmAge(friend.page);
  const acceptedAt = Date.now();
  await friend.page.waitForURL(/[?&]online=/);
  await sender.page.waitForURL(/[?&]online=/, { timeout: 30_000 });
  const lobbyToMatchMs = Date.now() - acceptedAt;
  return { sender, friend, lobbyToMatchMs };
}

interface Log {
  fights: { round: number; attempt: number; at: number; scheduled: number }[];
  picks: { round: number; sent: number; answered: number }[];
  seen: { version: number; at: number }[];
  offset: number;
}
const logOf = (page: Page) =>
  page.evaluate(() => (globalThis as { __live?: unknown }).__live) as Promise<Log>;

function summary(a: Counted, b: Counted, la: Log, lb: Log, extra: Record<string, unknown>) {
  const gaps = la.fights.flatMap((f) => {
    const other = lb.fights.find((g) => g.round === f.round && g.attempt === f.attempt);
    return other === undefined
      ? []
      : [
          {
            round: f.round,
            attempt: f.attempt,
            gapMs: Math.abs(f.at - other.at),
            lateA: f.at - (f.scheduled - la.offset),
            lateB: other.at - (other.scheduled - lb.offset),
          },
        ];
  });
  const delays = [
    ...la.picks.map((p) => ({
      by: 'sender',
      ms: (lb.seen.find((s) => s.at >= p.sent)?.at ?? NaN) - p.sent,
      post: p.answered - p.sent,
    })),
    ...lb.picks.map((p) => ({
      by: 'friend',
      ms: (la.seen.find((s) => s.at >= p.sent)?.at ?? NaN) - p.sent,
      post: p.answered - p.sent,
    })),
  ];
  const ms = (list: Counted['requests'], match: RegExp) =>
    list
      .filter((r) => match.test(r.url))
      .map((r) => r.ms)
      .sort((x, y) => x - y);
  const pct = (list: number[], p: number) =>
    list[Math.min(list.length - 1, Math.floor(list.length * p))] ?? NaN;
  const reads = [
    ...ms(a.requests, /^GET \/api\/v1\/series\//),
    ...ms(b.requests, /^GET \/api\/v1\/series\//),
  ].sort((x, y) => x - y);
  return {
    ...extra,
    fightGaps: gaps,
    pickToUpdate: delays,
    offsets: { sender: la.offset, friend: lb.offset },
    requests: {
      sender: a.requests.length,
      friend: b.requests.length,
      total: a.requests.length + b.requests.length,
    },
    byRoute: Object.entries(
      [...a.requests, ...b.requests].reduce<Record<string, number>>((acc, r) => {
        const key = `${r.url.replace(/[0-9a-f-]{36}|[A-Za-z0-9_-]{22}/g, ':id')} ${String(r.status)}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    ),
    seriesReadMs: { p50: pct(reads, 0.5), p90: pct(reads, 0.9), max: reads.at(-1) },
    pickPostMs: delays.map((d) => d.post),
  };
}

const browser = await chromium.launch();
try {
  const begun = Date.now();
  const { sender, friend, lobbyToMatchMs } = await start(browser);
  if (mode === 'disconnect') {
    // Round 1's first pick (whoever shows) goes in; then the friend drops for 15 s.
    await sender.page.waitForTimeout(8_000);
    await friend.context.setOffline(true);
    await sender.page
      .locator('#online-series', { hasText: 'disconnected' })
      .waitFor({ timeout: 30_000 });
    await sender.page.waitForTimeout(2_000);
    await shot(sender.page, 'disconnected');
    const droppedAt = Date.now();
    await sender.page.waitForTimeout(13_000);
    await friend.context.setOffline(false);
    await sender.page
      .locator('#online-series', { hasText: 'disconnected' })
      .waitFor({ state: 'detached', timeout: 30_000 })
      .catch(() => undefined);
    const backAfter = Date.now() - droppedAt;
    const stillOpen = !(await sender.page.locator('#online-series .series-result').isVisible());
    await shot(sender.page, 'reconnected');
    // Now for good: the sender should win by forfeit after the grace period.
    await friend.context.setOffline(true);
    const goneAt = Date.now();
    await sender.page.locator('#online-series .series-result').waitFor({ timeout: 90_000 });
    await shot(sender.page, 'forfeit');
    console.log(
      JSON.stringify(
        {
          mode,
          lobbyToMatchMs,
          reconnectedAfterMs: backAfter,
          stillOpenAfterReconnect: stillOpen,
          forfeitAfterMs: Date.now() - goneAt,
          result: await sender.page.locator('#online-series').innerText(),
        },
        null,
        2,
      ),
    );
  } else {
    let timerShot = false;
    let sawAuto = false;
    await Promise.all([
      player(sender.page, () => 3_000 + Math.random() * 9_000),
      player(
        friend.page,
        // The friend lets their first pick run out: a random ball is picked for them.
        (round) => (round === 0 && !sawAuto ? undefined : 3_000 + Math.random() * 9_000),
        async () => {
          if (!timerShot) {
            timerShot = true;
            await friend.page.waitForTimeout(4_000);
            await shot(friend.page, 'pick-timer');
          }
        },
      ),
      (async () => {
        await friend.page
          .locator('#online-series', { hasText: 'random ball was picked' })
          .waitFor({ timeout: 180_000 });
        sawAuto = true;
        await shot(friend.page, 'auto-pick');
      })(),
    ]);
    await shot(sender.page, 'result');
    const [la, lb] = await Promise.all([logOf(sender.page), logOf(friend.page)]);
    console.log(
      JSON.stringify(
        summary(sender, friend, la, lb, {
          mode,
          slow,
          lobbyToMatchMs,
          seriesSeconds: Math.round((Date.now() - begun) / 1000),
          sawAutoPick: sawAuto,
        }),
        null,
        2,
      ),
    );
  }
} finally {
  await browser.close();
}
