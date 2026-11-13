// Times the arena's frame callback in headless Chromium on a throttled phone profile (ADR 0034, 0043
// and 0049, the method of ADR 0027 and 0028): 390 x 844 (an iPhone) at 2x density with 4x CPU throttling, over a few
// whole matches, at 60 Hz (the browser's own requestAnimationFrame) and at 90 and 120 Hz (a fixed
// driver that calls the frame callbacks on that rhythm). Prints frames, median, p95, max and the
// count over 16.7 ms per rate. Needs a running server (pnpm dev or pnpm preview).
//   node scripts/frame-timing.ts [base-url=http://localhost:5199/]
// Not part of CI: timings depend on the machine.
import { chromium, type Page } from 'playwright';
import { BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import { playToEnd } from '../src/sim/series-verify.ts';
import { createWorld } from '../src/sim/world.ts';

const base = process.argv[2] ?? 'http://localhost:5199/';

/**
 * The matches to time: the busiest moments of the balls changed last (ADR 0049): six webs on the
 * walls with the Speedster caught again and again, the Hex's curse counting down and bursting on the
 * Berserker and among the Spider's webs, and the Ghost phasing through the Boomerang's throws and
 * Venom's poison, each played to its end.
 */
const MATCHES: readonly (readonly [string, string, number])[] = [
  ['spider', 'speedster', 3],
  ['hex', 'berserker', 2],
  ['hex', 'spider', 2],
  ['ghost', 'boomerang', 2],
  ['ghost', 'venom', 3],
];

/**
 * Installed before the page loads, as page code (this script has no DOM types): wraps every frame
 * callback to time it, and at 90 or 120 Hz replaces the browser's rhythm with a fixed driver that
 * runs the queued callbacks together on each beat.
 */
function timer(hz: number): string {
  return `
    const times = [];
    window.__frameTimes = times;
    const native = window.requestAnimationFrame.bind(window);
    const timed = (callback) => (now) => {
      const start = performance.now();
      callback(now);
      times.push(performance.now() - start);
    };
    if (${String(hz)} === 60) {
      window.requestAnimationFrame = (callback) => native(timed(callback));
    } else {
      let queue = [];
      window.requestAnimationFrame = (callback) => {
        queue.push(timed(callback));
        return queue.length;
      };
      setInterval(() => {
        const due = queue;
        queue = [];
        const now = performance.now();
        for (const callback of due) callback(now);
      }, ${String(1000 / hz)});
    }`;
}

/** Seconds a match lasts in sim time, so the page is timed until it ends (plus the result). */
function matchSeconds(a: string, b: string, seed: number): number {
  const world = createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
  return playToEnd(world, BALL_LOOKUP).tick / 60;
}

async function timeRate(hz: number): Promise<number[]> {
  const browser = await chromium.launch();
  const all: number[] = [];
  for (const [a, b, seed] of MATCHES) {
    const page: Page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript({ content: timer(hz) });
    await page.goto(`${base}?a=${a}&b=${b}&seed=${String(seed)}&v=${String(RULESET_VERSION)}`);
    // A new pairing waits on its ready card (ADR 0037): start the fight, or only the card is timed.
    await page.getByRole('button', { name: 'Fight!' }).click({ timeout: 5000 });
    await page.waitForTimeout((matchSeconds(a, b, seed) + 3) * 1000);
    const times: unknown = await page.evaluate('window.__frameTimes');
    if (Array.isArray(times)) all.push(...times.filter((t): t is number => typeof t === 'number'));
    await page.close();
  }
  await browser.close();
  return all;
}

const quantile = (sorted: readonly number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

console.log('Refresh  Frames  Median   p95      Max      Over 16.7 ms');
for (const hz of [60, 90, 120]) {
  const times = [...(await timeRate(hz))].sort((x, y) => x - y);
  const ms = (value: number) => `${value.toFixed(1)} ms`.padEnd(9);
  console.log(
    `${`${String(hz)} Hz`.padEnd(9)}${String(times.length).padEnd(8)}${ms(quantile(times, 0.5))}` +
      `${ms(quantile(times, 0.95))}${ms(times.at(-1) ?? 0)}${String(times.filter((t) => t > 16.7).length)}`,
  );
}
