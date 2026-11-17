// Where a fight's frames go on a slow phone held to 30 frames a second (iPhone Low Power Mode, ADR
// 0063 and its addendum): the real page at 390 x 664, Chromium with its CPU slowed (or WebKit, which
// has no slowdown), its animation frames either the browser's own or held to every other one (as
// Safari does in Low Power Mode). Per fight it prints the frames' intervals (how many came later
// than one beat and a half: a dropped frame), each frame's work in script (median, p95, max) and,
// in Chromium, the whole frame's main-thread work (script, style, layout, paint) from a trace.
// `--profile` adds the functions that took the most time (run against `pnpm dev` for real names).
// Needs a running server (pnpm preview, or pnpm dev with --profile). Not part of CI: timings
// depend on the machine.
//   node scripts/low-power-frames.ts [chromium|webkit] [base=http://localhost:4199/]
//     [--cpu N] [--cap 30|native] [--dpr N] [--profile] [--sound] [--match a,b,seed]
import { chromium, webkit, type Browser, type CDPSession, type Page } from 'playwright';
import { BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';
import { playToEnd } from '../src/sim/series-verify.ts';
import { createWorld } from '../src/sim/world.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
const engine = positional[0] ?? 'chromium';
const base = positional[1] ?? 'http://localhost:4199/';
const cpu = Number(flag('--cpu') ?? 4);
const cap = flag('--cap') ?? '30';
const dpr = Number(flag('--dpr') ?? 3);
const profile = args.includes('--profile');
const sound = args.includes('--sound');
const only = flag('--match')?.split(',');

/** Busy fights: webs and a fast ball, a curse among webs, poison and fire, a volley, a split. */
const MATCHES: readonly (readonly [string, string, number])[] = [
  ['spider', 'speedster', 3],
  ['hex', 'spider', 2],
  ['venom', 'inferno', 4],
  ['archer', 'quake', 2],
  ['slime', 'necromancer', 3],
];

/**
 * Installed before the page loads: at a cap of 30, each animation frame callback runs on every
 * other frame of the browser's own (as Safari does in Low Power Mode); every frame's callbacks are
 * timed together, and the interval between frames is noted while `__measuring` is set.
 */
const PROBE = `
  window.__frames = { intervals: [], work: [] };
  const native = window.requestAnimationFrame.bind(window);
  const capped = ${cap === '30' ? 'true' : 'false'};
  let queue = [];
  let odd = false;
  let last;
  const run = (now) => {
    native(run);
    odd = !odd;
    if (capped && odd) return;
    const due = queue;
    queue = [];
    if (due.length === 0) return;
    const start = performance.now();
    for (const callback of due) callback(now);
    if (window.__measuring) {
      window.__frames.work.push(performance.now() - start);
      if (last !== undefined) window.__frames.intervals.push(now - last);
      last = now;
    } else last = undefined;
  };
  native(run);
  window.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
`;

function matchSeconds(a: string, b: string, seed: number): number {
  const world = createWorld(seed, [getDefinition(BALL_LOOKUP, a), getDefinition(BALL_LOOKUP, b)]);
  return playToEnd(world, BALL_LOOKUP).tick / 60;
}

const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
};

interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly dur?: number;
  readonly ts: number;
  readonly tid: number;
  readonly cat: string;
}

/** Main-thread busy time per frame from a Chromium trace: every top-level task, summed by kind. */
async function traceFight(cdp: CDPSession, during: () => Promise<void>): Promise<string> {
  const events: TraceEvent[] = [];
  cdp.on('Tracing.dataCollected', ({ value }) => {
    events.push(...(value as unknown as TraceEvent[]));
  });
  const done = new Promise<void>((resolve) =>
    cdp.once('Tracing.tracingComplete', () => {
      resolve();
    }),
  );
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
  });
  await during();
  await cdp.send('Tracing.end');
  await done;
  const main = events.find(
    (event) => event.name === 'CrRendererMain' || event.name === 'thread_name',
  );
  const mainTid = events
    .filter((event) => event.name === 'RunTask' && event.cat.includes('devtools.timeline'))
    .reduce<Map<number, number>>((counts, event) => {
      counts.set(event.tid, (counts.get(event.tid) ?? 0) + (event.dur ?? 0));
      return counts;
    }, new Map());
  const tid = [...mainTid.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? main?.tid;
  const sum = (name: string) =>
    events
      .filter((event) => event.tid === tid && event.name === name && event.ph === 'X')
      .reduce((total, event) => total + (event.dur ?? 0), 0) / 1000;
  const frames = events.filter(
    (event) => event.tid === tid && event.name === 'FireAnimationFrame' && event.ph === 'X',
  ).length;
  const per = (ms: number) => (frames > 0 ? (ms / frames).toFixed(2) : '-');
  return (
    `per frame (${String(frames)}): script ${per(sum('FireAnimationFrame'))} ms, ` +
    `style ${per(sum('UpdateLayoutTree'))}, layout ${per(sum('Layout'))}, ` +
    `paint ${per(sum('Paint'))}, composite ${per(sum('Layerize') + sum('UpdateLayer'))}, ` +
    `timers ${per(sum('TimerFire'))}`
  );
}

interface ProfileNode {
  readonly id: number;
  readonly callFrame: {
    readonly functionName: string;
    readonly url: string;
    readonly lineNumber: number;
  };
  readonly children?: readonly number[];
}

/** The functions with the most self time over the fight. */
function topFunctions(
  nodes: readonly ProfileNode[],
  samples: readonly number[],
  deltas: readonly number[],
): string {
  const self = new Map<number, number>();
  samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (deltas[i] ?? 0)));
  const byName = new Map<string, number>();
  for (const node of nodes) {
    const { functionName, url, lineNumber } = node.callFrame;
    const file = url.split('/').at(-1)?.split('?')[0] ?? '';
    const key = `${functionName || '(anonymous)'} ${file}:${String(lineNumber + 1)}`;
    byName.set(key, (byName.get(key) ?? 0) + (self.get(node.id) ?? 0));
  }
  const total = [...byName.values()].reduce((a, b) => a + b, 0);
  return [...byName.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 14)
    .map(([name, us]) => `    ${((us / total) * 100).toFixed(1).padStart(5)}%  ${name}`)
    .join('\n');
}

async function measure(browser: Browser, a: string, b: string, seed: number): Promise<void> {
  const page: Page = await browser.newPage({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: dpr,
    isMobile: engine === 'chromium',
    hasTouch: true,
  });
  await page.addInitScript({ content: PROBE });
  await page.addInitScript({
    content: `localStorage.setItem('ballbattle.speed', '1');
      localStorage.setItem('ballbattle.sound', ${sound ? "'on'" : "'off'"});`,
  });
  const cdp = engine === 'chromium' ? await page.context().newCDPSession(page) : undefined;
  if (cdp !== undefined && cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${base}?a=${a}&b=${b}&seed=${String(seed)}&v=${String(RULESET_VERSION)}`);
  await page.getByRole('button', { name: 'Fight!' }).tap({ timeout: 10_000 });
  await page.evaluate('window.__measuring = true');
  const fightMs = (matchSeconds(a, b, seed) + 2.5) * 1000;
  let traced = '';
  let top = '';
  if (cdp !== undefined && profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await page.waitForTimeout(fightMs);
    const { profile: result } = (await cdp.send('Profiler.stop')) as unknown as {
      profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };
    };
    top = topFunctions(result.nodes, result.samples, result.timeDeltas);
  } else if (cdp !== undefined) {
    traced = await traceFight(cdp, () => page.waitForTimeout(fightMs));
  } else {
    await page.waitForTimeout(fightMs);
  }
  const { intervals, work } = await page.evaluate<{ intervals: number[]; work: number[] }>(
    'window.__frames',
  );
  const beat = quantile(intervals, 0.5);
  const late = intervals.filter((ms) => ms > beat * 1.5).length;
  const f = (ms: number) => ms.toFixed(1);
  console.log(
    `${`${a} vs ${b}`.padEnd(22)} frames ${String(intervals.length).padEnd(5)} beat ${f(beat)} ms, ` +
      `late ${String(late)} (${f((late / Math.max(1, intervals.length)) * 100)}%), ` +
      `worst gap ${f(Math.max(0, ...intervals))} ms; work median ${f(quantile(work, 0.5))}, ` +
      `p95 ${f(quantile(work, 0.95))}, max ${f(Math.max(0, ...work))} ms`,
  );
  if (traced !== '') console.log(`  ${traced}`);
  if (top !== '') console.log(top);
  await page.close();
}

const browser = await (engine === 'webkit' ? webkit : chromium).launch();
console.log(
  `${engine}, CPU ${engine === 'chromium' ? `${String(cpu)}x slower` : 'as is'}, frames ${cap === '30' ? 'held to every other one' : 'as the browser gives them'}, ${String(dpr)}x pixels${sound ? ', sound on' : ''}`,
);
const chosen: typeof MATCHES =
  only === undefined
    ? MATCHES
    : [[only[0] ?? 'brawler', only[1] ?? 'brawler', Number(only[2] ?? 1)]];
for (const [a, b, seed] of chosen) await measure(browser, a, b, seed);
await browser.close();
