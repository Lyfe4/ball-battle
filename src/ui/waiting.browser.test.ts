// The waiting ball (waiting.ts): one smooth loop that keeps the page's time, so a ball drawn again
// mid-wait (the lobby redraws every few seconds) is where the last one was, never back at the
// bottom (the 2026-11-27 staging check: it fell, then jumped back); still under reduced motion.
import { describe, expect, it } from 'vitest';
import '../style.css';
import { createWaiting, waitingBall } from './waiting.ts';

const heightOf = (ball: Element): number =>
  new DOMMatrix(getComputedStyle(ball, '::before').transform).f;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

describe('the waiting ball', () => {
  it('drawn again mid-wait, is where the last one was', async () => {
    const first = waitingBall();
    document.body.replaceChildren(first);
    await wait(400);
    // The lobby's redraw: a new ball beside the old one, which keeps moving.
    const again = waitingBall();
    document.body.append(again);
    const before = heightOf(first);
    const after = heightOf(again);
    expect(Math.abs(after - before), `${String(after)} against ${String(before)}`).toBeLessThan(1);
    if (!reduced) expect(after).toBeLessThan(23);
  });

  it('keeps the page’s time even when its first frame comes late (a busy page, CI)', async () => {
    const first = waitingBall();
    document.body.replaceChildren(first);
    // The frame that starts its loop is held up: a long task right after it is drawn.
    const busyUntil = performance.now() + 120;
    while (performance.now() < busyUntil) {
      // Busy, as a loaded phone or CI machine is.
    }
    await wait(400);
    const again = waitingBall();
    document.body.append(again);
    const before = heightOf(first);
    const after = heightOf(again);
    expect(Math.abs(after - before), `${String(after)} against ${String(before)}`).toBeLessThan(1);
  });

  it('rises and falls on one even curve, top and bottom soft (no jump between frames)', async () => {
    document.body.replaceChildren(waitingBall());
    const ball = document.querySelector('.waiting-ball');
    if (ball === null) throw new Error('no ball');
    const heights: number[] = [];
    const times: number[] = [];
    for (let frame = 0; frame < 150; frame += 1) {
      heights.push(heightOf(ball));
      times.push(Number(document.timeline.currentTime));
      await new Promise((done) => requestAnimationFrame(done));
    }
    // Speed on the animations' own clock, not px a frame: a busy machine (CI's WebKit) drops
    // frames, and a smooth curve then moves several px between two samples (4.4 px over ~80 ms,
    // the run that failed #265). 24 px in a 900 ms swing on --ease-swing peaks at 2 x 24 / 900
    // = 0.053 px/ms; a jump (the loop starting again from the bottom) is many times that.
    const speeds = heights.slice(1).flatMap((height, index) => {
      const ms = (times[index + 1] ?? 0) - (times[index] ?? 0);
      return ms > 0 ? [Math.abs(height - (heights[index] ?? 0)) / ms] : [];
    });
    expect(speeds.length).toBeGreaterThan(100);
    expect(Math.max(...speeds)).toBeLessThan(0.12);
    if (!reduced) expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(20);
  });

  it('is the card’s, with the friend’s disc beside the title, never in the ball’s place', () => {
    const card = createWaiting({ title: 'Waiting for Jo', line: 'Best of 3', who: 'Jo' });
    document.body.replaceChildren(card);
    expect(card.querySelectorAll('.waiting-ball')).toHaveLength(1);
    expect(card.querySelector('.waiting-title .waiting-disc')?.textContent).toBe('J');
    expect(card.querySelector('.waiting-title-text')?.textContent).toBe('Waiting for Jo');
  });
});
