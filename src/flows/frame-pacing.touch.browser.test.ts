// Fights at a capped frame rate (iPhone Low Power Mode holds Safari at 30 frames a second, the sim
// runs 60 ticks): the real page at phone size, its animation frames held to 30 a second (and to an
// uneven 25/42 ms beat), and every ball's drawn centre recorded per frame. Smooth motion moves a
// ball by the same distance for the same time; the measure is how far each frame's speed strays
// from the ball's median speed, between bounces. Render-side only: the fight itself is never
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

/** Holds the page's animation frames to `beat(n)` ms apart, stamped with the real time. */
function capFrames(beat: (n: number) => number): void {
  let queue: FrameRequestCallback[] = [];
  let n = 0;
  const tick = () => {
    const due = queue;
    queue = [];
    const at = performance.now();
    (globalThis as unknown as { __frame: number }).__frame = n;
    for (const callback of due) callback(at);
    n += 1;
    setTimeout(tick, beat(n));
  };
  window.requestAnimationFrame = (callback) => {
    queue.push(callback);
    return queue.length;
  };
  setTimeout(tick, beat(0));
}

/** Records the centre of every round ball drawn (its body's arc), by frame. */
function recordBalls(): Drawn[] {
  const drawn: Drawn[] = [];
  const prototype = CanvasRenderingContext2D.prototype;
  const arc = Object.getOwnPropertyDescriptor(prototype, 'arc')?.value as typeof prototype.arc;
  prototype.arc = function (this, x, y, radius, ...rest) {
    if (radius === 50 && this.canvas.id === 'arena') {
      const frame = (globalThis as unknown as { __frame: number }).__frame;
      drawn.push({ frame, at: performance.now(), x, y });
    }
    arc.call(this, x, y, radius, ...rest);
  };
  return drawn;
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
    capFrames(BEATS[which] ?? (() => 1000 / 30));
    const drawn = recordBalls();
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
    const { p90, frames } = speedJitter(drawn.filter((point) => point.at > from));
    console.log(
      `frame pacing at ${which}: p90 speed jitter ${(p90 * 100).toFixed(1)}% over ${String(frames)} frames`,
    );
    expect(frames).toBeGreaterThan(60);
    expect(p90).toBeLessThan(0.1);
  });
});
