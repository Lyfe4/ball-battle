// The first paint is the real frame (ADR 0087): a first visit's page shows its first screen once,
// in its place, in the game's font. Each screen opens in a frame of its own (a fresh document, as a
// first visit), and the flow checks the causes of a shifting first paint, each on its own:
//
// - the stage is invisible until it shows (`data-booting`), and shows once (a performance mark);
// - the font was ready when it showed;
// - the canvas, when the stage shows, is the size its container lays out (never its default
//   300 x 150, never a size it then corrects), with a backing store to match;
// - no landmark (header, title, tab bar, Play, the grid, the canvas, the panel) moves after it shows;
// - in Chromium, which reports layout shifts, their sum after it shows stays within FIRST_PAINT_CLS.
//
// The dev server injects the stylesheet by script, so a page there paints unstyled before its
// script runs; production's stylesheet is in the head, so nothing paints before the stage shows.
// Shifts are therefore counted from the stage showing, which is all a player sees in production.
import { expect } from 'vitest';
import { FIRST_PAINT_FONT, STAGE_SHOWN_MARK } from '../app/first-paint.ts';
import { frames } from './page-support.ts';
import { openFramed, waitFor, type Framed } from './reload-support.ts';

/**
 * The most layout shift a first visit may show after the stage shows (Chromium's layout-shift
 * score; good is 0.1). Measured 0 in 10 local runs of every screen at every size (2026-11-25):
 * the margin is for a font that misses FONT_WAIT_MS on a loaded CI machine.
 */
export const FIRST_PAINT_CLS = 0.02;

/** What a player sees as the frame of a screen: these must not move once the stage shows. */
const LANDMARKS =
  '.screen-header, h1, h2, nav.tab-bar, .play-box, .home-play, .ball-grid, #arena, .hud';

/** Each landmark's box, rounded to a tenth of a pixel, keyed by its place in the document. */
function landmarksOf(framed: Framed): Record<string, string> {
  const boxes: Record<string, string> = {};
  framed
    .doc()
    .querySelectorAll<HTMLElement>(LANDMARKS)
    .forEach((node, at) => {
      if (node.closest('[hidden]') !== null || node.getClientRects().length === 0) return;
      const box = node.getBoundingClientRect();
      const r = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
      boxes[`${String(at)} ${node.tagName.toLowerCase()}.${node.className.split(' ')[0] ?? ''}`] =
        `${r(box.x)},${r(box.y)} ${r(box.width)}x${r(box.height)}`;
    });
  return boxes;
}

interface Shift {
  readonly value: number;
  readonly startTime: number;
  readonly hadRecentInput: boolean;
  readonly sources: readonly { readonly node?: Node | null }[];
}

/**
 * The dev server's own unstyled paint: it injects the stylesheet by script, so the page can paint
 * once with the browser's default 8 px body margin, and when the stylesheet lands in the same frame
 * the stage shows (a fast load, the font preloaded), that margin going is stamped as a shift of the
 * body alone at the stage's first frame. Production's stylesheet is in the head: no such paint.
 */
const unstyledBody = (shift: Shift): boolean =>
  shift.sources.length > 0 && shift.sources.every((source) => source.node?.nodeName === 'BODY');

/** The frame's layout shifts so far (buffered from its start), where the browser reports them. */
function shiftsOf(framed: Framed): Promise<readonly Shift[] | undefined> {
  const win = framed.win() as Window & typeof globalThis;
  if (!win.PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const observer = new win.PerformanceObserver((list) => {
      observer.disconnect();
      resolve(list.getEntries() as unknown as Shift[]);
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    // No shift at all: the observer is never called.
    win.setTimeout(() => {
      observer.disconnect();
      resolve([]);
    }, 300);
  });
}

/** The canvas's laid-out box and the square its container gives it, in CSS pixels. */
function canvasFit(framed: Framed) {
  const doc = framed.doc();
  const canvas = doc.querySelector<HTMLCanvasElement>('#arena');
  const container = doc.querySelector<HTMLElement>('#arena-container');
  if (canvas === null || container === null) throw new Error('No arena');
  const style = framed.win().getComputedStyle(container);
  const px = (value: string) => Number.parseFloat(value) || 0;
  const width = container.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
  const height = container.clientHeight - px(style.paddingTop) - px(style.paddingBottom);
  const square = Math.max(0, Math.floor(Math.min(width, height)));
  const ratio = Math.min(framed.win().devicePixelRatio || 1, 2);
  const box = canvas.getBoundingClientRect();
  return {
    shown: canvas.getClientRects().length > 0,
    box: canvas.getClientRects().length > 0 ? `${String(box.width)}x${String(box.height)}` : 'none',
    laidOut: `${String(square)}x${String(square)}`,
    store: `${String(canvas.width)}x${String(canvas.height)}`,
    storeFor: `${String(Math.round(square * ratio))}x${String(Math.round(square * ratio))}`,
  };
}

/** Opens `search` as a first visit and checks its first paint (above). */
export async function checkFirstPaint(search: string, where: string): Promise<void> {
  const framed = await openFramed(search);
  await waitFor(
    framed,
    () => framed.win().performance.getEntriesByName(STAGE_SHOWN_MARK).length > 0,
    10_000,
    `the stage of ${where} to show`,
  );
  const stage = framed.doc().querySelector<HTMLElement>('#stage');
  const marks = framed.win().performance.getEntriesByName(STAGE_SHOWN_MARK) as PerformanceMark[];
  const shownAt = marks[0]?.startTime ?? 0;
  expect(
    {
      where,
      booting: stage?.dataset['booting'] !== undefined,
      fallback: framed.doc().getElementById('boot-fallback') !== null,
      shownOnce: marks.length,
      fontReady: (marks[0]?.detail as { fontReady?: boolean } | undefined)?.fontReady,
      fontNow: framed.doc().fonts.check(FIRST_PAINT_FONT),
    },
    where,
  ).toStrictEqual({
    where,
    booting: false,
    fallback: false,
    shownOnce: 1,
    fontReady: true,
    fontNow: true,
  });

  // The canvas as it first shows: its container's size, its backing store to match.
  const fit = canvasFit(framed);
  if (fit.shown) {
    expect({ where, box: fit.box, store: fit.store }).toStrictEqual({
      where,
      box: fit.laidOut,
      store: fit.storeFor,
    });
  }

  // Nothing moves after the stage shows: the boxes now and after 30 frames and a moment.
  const first = landmarksOf(framed);
  expect(Object.keys(first).length, `${where}: landmarks seen`).toBeGreaterThan(2);
  await frames(30, framed.win());
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(landmarksOf(framed), `${where}: a landmark moved after the stage showed`).toStrictEqual(
    first,
  );

  const shifts = await shiftsOf(framed);
  if (shifts !== undefined) {
    const after = shifts.filter(
      (one) => one.startTime >= shownAt && !one.hadRecentInput && !unstyledBody(one),
    );
    const sum = after.reduce((total, one) => total + one.value, 0);
    expect(sum, `${where}: layout shift after the stage showed`).toBeLessThanOrEqual(
      FIRST_PAINT_CLS,
    );
  }
}
