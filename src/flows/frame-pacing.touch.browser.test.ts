// Fights at a capped frame rate (iPhone Low Power Mode holds Safari at 30 frames a second, the sim
// runs 60 ticks): the real page at phone size, its animation frames held to 30 a second (and to an
// uneven 25/42 ms beat), and every ball's drawn centre recorded per frame. Smooth motion moves a
// ball by the same distance for the same time; the measure is how far each frame's speed strays
// from the ball's median speed, between bounces. Each frame's work is timed too: a frame that
// takes its whole beat is dropped on a slow phone (ADR 0063 addendum), and on slow frames each
// ball is smeared over its path since the last one. Render-side only: the fight itself is never
// touched (the golden results stay as they are).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { READY_CARD_STORAGE_KEY } from '../app/tips.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { settle, until } from './page-support.ts';

interface Drawn {
  readonly frame: number;
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Holds the page's animation frames to `beat(n)` ms apart, stamped with the real time; each
 * frame's callbacks are timed together into `work`.
 */
function capFrames(beat: (n: number) => number, work: number[]): void {
  let queue: FrameRequestCallback[] = [];
  let n = 0;
  const tick = () => {
    const due = queue;
    queue = [];
    const at = performance.now();
    (globalThis as unknown as { __frame: number; __frameAt: number }).__frame = n;
    (globalThis as unknown as { __frameAt: number }).__frameAt = at;
    for (const callback of due) callback(at);
    work.push(performance.now() - at);
    n += 1;
    setTimeout(tick, beat(n));
  };
  window.requestAnimationFrame = (callback) => {
    queue.push(callback);
    return queue.length;
  };
  setTimeout(tick, beat(0));
}

/**
 * Records the centre of every round ball drawn (its body's arc), by frame, stamped with the frame's
 * own time: the time the page was given and draws for. The clock at the arc itself would add the
 * frame's work so far (up to 7 ms on a busy CI machine, 2026-11-24), which is the runner's noise,
 * not the page's pacing.
 */
function recordBalls(): Drawn[] {
  const drawn: Drawn[] = [];
  const prototype = CanvasRenderingContext2D.prototype;
  const arc = Object.getOwnPropertyDescriptor(prototype, 'arc')?.value as typeof prototype.arc;
  prototype.arc = function (this, x, y, radius, ...rest) {
    if (radius === 50 && this.canvas.id === 'arena') {
      const { __frame: frame, __frameAt: at } = globalThis as unknown as {
        __frame: number;
        __frameAt: number;
      };
      drawn.push({ frame, at, x, y });
    }
    arc.call(this, x, y, radius, ...rest);
  };
  return drawn;
}

/** The frames that drew a smear (a stroked gradient band, motion-smear.ts) on the arena. */
function recordSmears(): Set<number> {
  const frames = new Set<number>();
  const prototype = CanvasRenderingContext2D.prototype;
  const gradient = Object.getOwnPropertyDescriptor(prototype, 'createLinearGradient')
    ?.value as typeof prototype.createLinearGradient;
  prototype.createLinearGradient = function (this, ...rest) {
    if (this.canvas.id === 'arena')
      frames.add((globalThis as unknown as { __frame: number }).__frame);
    return gradient.apply(this, rest);
  };
  return frames;
}

/**
 * The 90th-percentile share by which a frame's speed strays from the median speed, for the first
 * ball drawn each frame, leaving out frames around a bounce (where the direction turns).
 */
function speedJitter(drawn: readonly Drawn[]): { p90: number; frames: number } {
  const firsts = new Map<number, Drawn>();
  for (const point of drawn) if (!firsts.has(point.frame)) firsts.set(point.frame, point);
  const frames = [...firsts.values()].sort((a, b) => a.frame - b.frame);
  const speeds: number[] = [];
  for (let i = 2; i < frames.length; i += 1) {
    const [a, b, c] = [frames[i - 2], frames[i - 1], frames[i]];
    if (a === undefined || b === undefined || c === undefined) continue;
    const before = { x: b.x - a.x, y: b.y - a.y };
    const now = { x: c.x - b.x, y: c.y - b.y };
    // A turn (a bounce or a hit) between the frames: not a measure of pacing.
    const dot = before.x * now.x + before.y * now.y;
    const lengths = Math.hypot(before.x, before.y) * Math.hypot(now.x, now.y);
    if (lengths === 0 || dot / lengths < 0.995) continue;
    speeds.push(Math.hypot(now.x, now.y) / (c.at - b.at));
  }
  const sorted = [...speeds].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const strays = speeds.map((speed) => Math.abs(speed - median) / median).sort((a, b) => a - b);
  return { p90: strays[Math.floor(strays.length * 0.9)] ?? 1, frames: speeds.length };
}

const BEATS: Record<string, (n: number) => number> = {
  '120 fps': () => 1000 / 120,
  '60 fps': () => 1000 / 60,
  '30 fps': () => 1000 / 30,
  'uneven 25/42 ms': (n) => (n % 2 === 0 ? 25 : 42),
};
/** The beat measured: the uneven one by default, the hardest (`VITE_FRAME_BEAT` picks another). */
const which = (import.meta.env['VITE_FRAME_BEAT'] as string | undefined) ?? 'uneven 25/42 ms';

describe('a fight at a capped frame rate', () => {
  it(`moves each ball evenly at ${which}`, async () => {
    window.localStorage.setItem(READY_CARD_STORAGE_KEY, 'off');
    window.localStorage.setItem('ballbattle.speed', '1');
    const work: number[] = [];
    capFrames(BEATS[which] ?? (() => 1000 / 30), work);
    const drawn = recordBalls();
    const smeared = recordSmears();
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=brawler&b=magnet&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    // Four seconds of fighting after the intro.
    await until(() => drawn.length > 0, 5_000, 'the balls to be drawn');
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    // After the intro's pop-in.
    const from = (drawn[0]?.at ?? 0) + 1_400;
    const fighting = drawn.filter((point) => point.at > from);
    const { p90, frames } = speedJitter(fighting);
    const sorted = [...work].sort((a, b) => a - b);
    const workP95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    // Each fight frame's real gap from the one before (the harness's timers may run slower than
    // asked: WebKit's held to about 27 a second at the 60 fps beat).
    const at = new Map(fighting.map((point) => [point.frame, point.at]));
    const gaps = [...at.entries()].flatMap(([frame, time]) => {
      const before = at.get(frame - 1);
      return before === undefined ? [] : [{ frame, gap: time - before }];
    });
    const slow = gaps.filter(({ gap }) => gap >= 26);
    const fast = gaps.filter(({ gap }) => gap <= 20);
    const smearShare =
      slow.filter(({ frame }) => smeared.has(frame)).length / Math.max(1, slow.length);
    console.log(
      `frame pacing at ${which}: p90 speed jitter ${(p90 * 100).toFixed(1)}% over ${String(frames)} frames, ` +
        `work p95 ${workP95.toFixed(1)} ms, smeared ${(smearShare * 100).toFixed(0)}% of ${String(slow.length)} slow frames, ${String(fast.filter(({ frame }) => smeared.has(frame)).length)} of ${String(fast.length)} fast`,
    );
    expect(frames).toBeGreaterThan(60);
    expect(p90).toBeLessThan(0.1);
    // A frame's work is a few tenths of a ms on a desktop and about 2 ms with the CPU slowed 6x
    // (scripts/low-power-frames.ts): far inside a 33 ms beat. Half the 60 Hz beat leaves
    // room for a slow CI machine and still fails if drawing ever costs a phone its frames.
    expect(workP95).toBeLessThan(1000 / 60 / 2);
    // Slow frames smear the moving balls; frames at 50 a second and faster never do.
    expect(fast.filter(({ frame }) => smeared.has(frame))).toStrictEqual([]);
    if (slow.length > 20) expect(smearShare).toBeGreaterThan(0.8);
  });
});
