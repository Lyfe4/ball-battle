// Frame pacing of a live friend match (ADR 0053) for both roles on one machine: the sender (who
// waits in the lobby) and the friend (who opens the link and accepts), two phones at 390 x 664
// against `netlify dev`, in Chromium (4x CPU throttling, as a phone) or WebKit (no throttling
// there). While a live fight plays on a page (the countdown lifted, the live line showing) it notes
// every frame's interval, the long tasks (Chromium) and the time spent in timer callbacks and in
// answers to the series' reads, then prints each role's numbers. Not part of CI: timings depend on
// the machine.
//   node scripts/live-frames.ts [chromium|webkit] [base-url=http://localhost:8888] [--offline] [--cpu N]
//     [--cap 30]
// --offline: an offline Reveal Best of 3 against the bot on the same page size, for comparison.
// --cap 30: animation frames run on every other frame of the browser's own, as Safari does in Low
// Power Mode (ADR 0063); a frame is dropped when it comes a beat and a half late.
import { chromium, webkit, type Browser, type Page } from 'playwright';

const [engine = 'chromium', base = 'http://localhost:8888', ...rest] = process.argv.slice(2);
const offline = rest.includes('--offline');
const rateAt = rest.indexOf('--cpu');
const rate = rateAt >= 0 ? Number(rest[rateAt + 1]) : 4;
const capped = rest[rest.indexOf('--cap') + 1] === '30' && rest.includes('--cap');
/** One frame's length: 60 a second, or 30 when held to every other frame. */
const BEAT_MS = capped ? 1000 / 30 : 1000 / 60;

/** Installed first when capped: every animation frame callback waits for every other frame. */
const CAP = `
  const native = window.requestAnimationFrame.bind(window);
  let queue = [];
  let odd = false;
  const run = (now) => {
    native(run);
    odd = !odd;
    if (odd) return;
    const due = queue;
    queue = [];
    for (const callback of due) callback(now);
  };
  native(run);
  window.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
`;

/** Installed before the page loads: notes frames and main-thread work while a fight plays. */
const PROBE = `
  window.__probe = { frames: [], longTasks: [], timerMs: 0, timerRuns: 0, timerMax: 0, resizes: 0, mutations: 0, readMs: 0, reads: 0 };
  const probe = window.__probe;
  const fighting = () => {
    const layer = document.querySelector('.ready-layer');
    const held = layer !== null && !layer.hidden;
    const line = document.querySelector('.live-line');
    const live = line !== null && !line.hidden && /normal speed/.test(line.textContent ?? '');
    const hud = document.querySelector('#hud-status');
    return !held && (live || (window.__offlineFight === true && hud !== null && !hud.closest('[hidden]')));
  };
  let last;
  const tick = (now) => {
    if (fighting()) { if (last !== undefined) probe.frames.push(now - last); last = now; }
    else last = undefined;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      if (!fighting()) return;
      for (const entry of list.getEntries()) probe.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: false });
  } catch {}
  const NativeRO = window.ResizeObserver;
  window.ResizeObserver = class extends NativeRO {
    constructor(callback) { super((...a) => { if (fighting()) probe.resizes += 1; callback(...a); }); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver((list) => { if (fighting()) probe.mutations += list.length; })
      .observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const wrap = (name) => {
    const native = window[name].bind(window);
    window[name] = (callback, ms, ...args) => native((...a) => {
      const start = performance.now();
      try { return callback(...a); } finally {
        if (fighting()) { const t = performance.now() - start; probe.timerMs += t; probe.timerRuns += 1; probe.timerMax = Math.max(probe.timerMax, t); }
      }
    }, ms, ...args);
  };
  wrap('setTimeout');
  wrap('setInterval');
  const text = Response.prototype.text;
  Response.prototype.text = function () {
    const series = this.url.includes('/api/v1/series/');
    return text.call(this).then((body) => {
      if (series && fighting()) {
        const start = performance.now();
        queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => {
          probe.readMs += performance.now() - start; probe.reads += 1;
        })));
      }
      return body;
    });
  };
`;

interface Probe {
  frames: number[];
  longTasks: number[];
  timerMs: number;
  timerRuns: number;
  timerMax: number;
  resizes: number;
  mutations: number;
  readMs: number;
  reads: number;
}

async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 664 } });
  const page = await context.newPage();
  if (capped) await page.addInitScript({ content: CAP });
  await page.addInitScript({ content: PROBE });
  if (engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  } else {
    // WebKit on Windows and Linux drops a Secure cookie on http://localhost: this phone keeps
    // its session cookie here and sends it with each request instead.
    let cookie = '';
    await context.route('**/api/v1/**', async (route) => {
      // Without If-None-Match: a route can't answer 304, so every read is a full answer here.
      const sent = { ...route.request().headers() };
      delete sent['if-none-match'];
      const headers = { ...sent, ...(cookie === '' ? {} : { cookie }) };
      // A read still under way when the phones close at the end is dropped, not an error.
      const response = await route.fetch({ headers }).catch(() => undefined);
      if (response === undefined) return;
      const set = response.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie');
      if (set !== undefined) cookie = set.value.split(';')[0] ?? '';
      const kept = Object.fromEntries(
        Object.entries(response.headers()).filter(([name]) => name !== 'set-cookie'),
      );
      await route.fulfill({ response, headers: kept });
    });
  }
  return page;
}

async function lineup(page: Page, done: string): Promise<void> {
  const button = page.locator('#online-lineup .screen-footer .hud-button-primary:visible');
  const grid = page.locator('#online-lineup .ball-grid button');
  await button.waitFor();
  for (let index = 0; (await button.isDisabled()) && index < 12; index += 1) {
    await grid.nth(index).click();
  }
  await page.getByRole('button', { name: done }).click();
}

/** The 16+ card: the first online action on a device (ADR 0055). */
async function age(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

/**
 * Presses what the series offers next (a pick, Fight!, Play round), found and clicked in the page
 * with plain selectors: Playwright's role queries cost tens of ms each on a slowed CPU, which
 * dropped the very frames being measured (about 7% of them in an offline series at 6x).
 */
async function pressNext(page: Page): Promise<void> {
  await page.evaluate(`{
    const shown = (element) => element.offsetParent !== null;
    const pick = [...document.querySelectorAll('.pick-row-pick')].find(shown);
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => shown(candidate) && /^(Fight!|Play round)/.test(candidate.textContent.trim()),
    );
    (pick ?? button)?.click();
  }`);
}

const finished = (page: Page): Promise<boolean> =>
  page.evaluate<boolean>(
    "document.querySelector('#online-series .series-result')?.offsetParent != null",
  );

function summary(role: string, probe: Probe): string {
  const frames = probe.frames;
  const sorted = [...frames].sort((x, y) => x - y);
  const q = (p: number) =>
    (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0).toFixed(1);
  const dropped = frames.reduce((n, ms) => n + Math.max(0, Math.round(ms / BEAT_MS) - 1), 0);
  const seconds = frames.reduce((s, ms) => s + ms, 0) / 1000;
  return [
    role.padEnd(8),
    `${String(frames.length)} frames / ${seconds.toFixed(0)} s`.padEnd(20),
    `p50 ${q(0.5)} p95 ${q(0.95)} p99 ${q(0.99)} max ${(sorted.at(-1) ?? 0).toFixed(0)} ms`.padEnd(
      40,
    ),
    `dropped ${String(dropped)} (${((100 * dropped) / Math.max(1, dropped + frames.length)).toFixed(1)}%)`.padEnd(
      22,
    ),
    `long tasks ${String(probe.longTasks.length)} (${probe.longTasks.reduce((s, d) => s + d, 0).toFixed(0)} ms)`.padEnd(
      26,
    ),
    `timers ${probe.timerMs.toFixed(0)} ms / ${String(probe.timerRuns)} (max ${probe.timerMax.toFixed(1)})`.padEnd(
      32,
    ),
    `resizes ${String(probe.resizes)} mutations ${String(probe.mutations)}`,
  ].join(' ');
}

async function liveRun(browser: Browser): Promise<void> {
  const sender = await phone(browser);
  const friend = await phone(browser);
  // From home, as a player starts it (ADR 0055): vs Friend, the 16+ question, Reveal, the lineup.
  await sender.goto(`${base}/`);
  await sender.locator('.home-chooser button[data-opponent="friend"]').click();
  await sender.locator('.home-play').click();
  await age(sender);
  await sender.getByRole('button', { name: 'Choose lineup' }).click();
  await lineup(sender, 'Send challenge');
  await sender.getByRole('heading', { name: 'Waiting for your friend' }).waitFor();
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';
  await friend.goto(`${base}/?challenge=${token}`);
  await friend.getByRole('button', { name: 'Build your lineup' }).click();
  await age(friend);
  await lineup(friend, 'Accept challenge');
  await friend.waitForURL(/[?&]online=/);
  await sender.waitForURL(/[?&]online=/, { timeout: 20_000 });
  const started = Date.now();
  while (!((await finished(sender)) && (await finished(friend)))) {
    if (Date.now() - started > 400_000) throw new Error('The match never ended');
    for (const page of [sender, friend]) await pressNext(page);
    await sender.waitForTimeout(1_000);
  }
  for (const [role, page] of [
    ['sender', sender],
    ['friend', friend],
  ] as const) {
    console.log(summary(role, await page.evaluate<Probe>('window.__probe')));
  }
}

async function offlineRun(browser: Browser): Promise<void> {
  // An offline Reveal Best of 3 against the bot: the same series screen, no server.
  const page = await phone(browser);
  await page.goto(`${base}/?mode=bo3&fmt=reveal&step=lineup`);
  await page.evaluate('window.__offlineFight = true');
  const grid = page.locator('#series-setup .ball-grid button');
  for (let index = 0; index < 3; index += 1) await grid.nth(index).click();
  await page.getByRole('button', { name: 'Reveal lineups' }).click();
  const started = Date.now();
  while (
    !(await page.evaluate<boolean>(
      "document.querySelector('#series .series-result')?.offsetParent != null",
    ))
  ) {
    if (Date.now() - started > 400_000) throw new Error('The series never ended');
    await pressNext(page);
    await page.waitForTimeout(1_000);
  }
  console.log(summary('offline', await page.evaluate<Probe>('window.__probe')));
}

const browser = await (engine === 'webkit' ? webkit : chromium).launch();
console.log(
  `${engine}${engine === 'chromium' ? `, ${String(rate)}x CPU throttling` : ''}, 390 x 664` +
    (capped ? ', frames held to 30 a second' : ''),
);
await (offline ? offlineRun(browser) : liveRun(browser));
await browser.close();
