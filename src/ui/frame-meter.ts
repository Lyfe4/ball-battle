// The frame meter (ADR 0063 addendum): with `?frames` in the URL, a small line at the top of the
// screen with the browser's frame rate, its late frames and its worst gap over the last 4 s, so a
// real phone can say whether a fight is held at a steady 30 (Low Power Mode) or dropping frames.
// Off unless asked for; it reads only the browser's frame times.
import { frameLine, frameStats } from '../app/frame-meter.ts';
import { element, setText } from './dom.ts';

/** Frames kept: about 4 s at 30 a second. */
const KEPT = 120;
const UPDATE_MS = 500;

export function installFrameMeter(search: URLSearchParams): void {
  if (!search.has('frames')) return;
  const meter = element('output', 'frame-meter', '… fps');
  meter.setAttribute('aria-label', 'Frame rate');
  document.body.append(meter);
  const gaps: number[] = [];
  let last: number | undefined;
  let shown = 0;
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    if (last !== undefined) {
      gaps.push(now - last);
      if (gaps.length > KEPT) gaps.shift();
    }
    last = now;
    if (now - shown >= UPDATE_MS) {
      shown = now;
      setText(meter, frameLine(frameStats(gaps)));
    }
  };
  requestAnimationFrame(frame);
  // A hidden page has no frames: its gap is not a dropped frame.
  document.addEventListener('visibilitychange', () => {
    last = undefined;
  });
}
