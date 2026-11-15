// Frame pacing of a live friend match (ADR 0053) for both roles on one machine: the sender (who
// waits in the lobby) and the friend (who opens the link and accepts), two phones at 390 x 664
// against `netlify dev`, in Chromium (4x CPU throttling, as a phone) or WebKit (no throttling
// there). While a live fight plays on a page (the countdown lifted, the live line showing) it notes
// every frame's interval, the long tasks (Chromium) and the time spent in timer callbacks and in
// answers to the series' reads, then prints each role's numbers. Not part of CI: timings depend on
// the machine.
//   node scripts/live-frames.ts [chromium|webkit] [base-url=http://localhost:8888] [--offline] [--cpu N]
// --offline: an offline Reveal Best of 3 against the bot on the same page size, for comparison.
import { chromium, webkit, type Browser, type Page } from 'playwright';

const [engine = 'chromium', base = 'http://localhost:8888', ...rest] = process.argv.slice(2);
const offline = rest.includes('--offline');
const rateAt = rest.indexOf('--cpu');
const rate = rateAt >= 0 ? Number(rest[rateAt + 1]) : 4;

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
      const response = await route.fetch({ headers });
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
  const grid = page.locator('#online-lineup .ball-grid button');
  for (let index = 0; index < 3; index += 1) await grid.nth(index).click();
  await page.getByRole('button', { name: done }).click();
}

async function age(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Play online' }).waitFor();
  await page.getByRole('button', { name: 'I’m 16 or older' }).click();
}

async function pickIfDue(page: Page): Promise<void> {
  const pick = page.locator('#online-series .pick-row-pick').first();
  if (await pick.isVisible()) await pick.click({ timeout: 2_000 }).catch(() => undefined);
}

const finished = (page: Page) => page.locator('#online-series .series-result').isVisible();

function summary(role: string, probe: Probe): string {
  const frames = probe.frames;
  const sorted = [...frames].sort((x, y) => x - y);
  const q = (p: number) =>
    (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0).toFixed(1);
  const dropped = frames.reduce((n, ms) => n + Math.max(0, Math.round(ms / (1000 / 60)) - 1), 0);
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
  await sender.goto(`${base}/?view=send&fmt=reveal&mode=bo3`);
  await lineup(sender, 'Send challenge');
  await age(sender);
  await sender.getByRole('heading', { name: 'Waiting for your friend…' }).waitFor();
  const token = new URL(sender.url()).searchParams.get('challenge') ?? '';
  await friend.goto(`${base}/?challenge=${token}`);
  await friend.getByRole('button', { name: 'Build your lineup' }).click();
  await lineup(friend, 'Accept challenge');
  await age(friend);
  await friend.waitForURL(/[?&]online=/);
  await sender.waitForURL(/[?&]online=/, { timeout: 20_000 });
  const started = Date.now();
  while (!((await finished(sender)) && (await finished(friend)))) {
    if (Date.now() - started > 400_000) throw new Error('The match never ended');
    for (const page of [sender, friend]) await pickIfDue(page);
    await sender.waitForTimeout(500);
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
  while (!(await page.locator('#series .series-result').isVisible())) {
    if (Date.now() - started > 400_000) throw new Error('The series never ended');
    for (const target of [
      page.locator('.pick-row-pick:visible').first(),
      page.getByRole('button', { name: 'Fight!' }),
      page.getByRole('button', { name: /^Play round/ }),
    ]) {
      if (await target.isVisible()) await target.click({ timeout: 2_000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);
  }
  console.log(summary('offline', await page.evaluate<Probe>('window.__probe')));
}

const browser = await (engine === 'webkit' ? webkit : chromium).launch();
console.log(
  `${engine}${engine === 'chromium' ? `, ${String(rate)}x CPU throttling` : ''}, 390 x 664`,
);
await (offline ? offlineRun(browser) : liveRun(browser));
await browser.close();
