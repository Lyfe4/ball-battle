// The first paint is the real frame (ADR 0087). index.html marks the stage `data-booting`, which
// layout.css draws invisible: the browser lays the page out but paints none of it, so nothing
// index.html holds (the empty HUD box, the canvas at its default 300 x 150) is ever seen moving
// when the first screen mounts. The stage shows once the router has laid out its first screen and
// the font is ready (preloaded, so it is nearly always there first), in one animation frame. A
// stylesheet timeout (--boot-safety) shows the stage and a line saying to reload if the script
// never gets here, so an error can never leave a blank page.

/** The family every screen's words are set in (tokens.css), at any size: its Latin subset. */
export const FIRST_PAINT_FONT = '1em "Bricolage Grotesque Variable"';

/**
 * How long the laid-out stage waits for the font before showing in the fallback font (the font then
 * swaps in). The font is preloaded and smaller than the script, so this is for a lost request.
 */
export const FONT_WAIT_MS = 1000;

/**
 * The performance mark at the moment the stage shows, with whether the font was ready then (read by
 * the first-paint flow).
 */
export const STAGE_SHOWN_MARK = 'ballbattle.stage-shown';

/** What the first paint uses of the browser's font set (`document.fonts`). */
export interface FirstPaintFonts {
  load(font: string): Promise<unknown>;
  check(font: string): boolean;
}

/** What the first paint uses of the window: the browser's own, or a test's fake. */
export interface FirstPaintWindow {
  readonly document: {
    readonly fonts?: FirstPaintFonts;
    getElementById(id: string): { remove(): void } | null;
  };
  readonly performance: { mark(name: string, options: { detail: unknown }): unknown };
  setTimeout(handler: () => void, ms: number): unknown;
  requestAnimationFrame(callback: () => void): unknown;
}

/**
 * Resolves in the animation frame the stage should show in: after the font is ready or
 * FONT_WAIT_MS, whichever is first; a font that fails to load waits no longer. Says which it was.
 */
export async function firstPaintReady(win: FirstPaintWindow): Promise<'font' | 'timeout'> {
  const font =
    win.document.fonts?.load(FIRST_PAINT_FONT).then(
      () => 'font' as const,
      () => 'font' as const,
    ) ?? Promise.resolve('font' as const);
  const timeout = new Promise<'timeout'>((resolve) => {
    win.setTimeout(() => {
      resolve('timeout');
    }, FONT_WAIT_MS);
  });
  const which = await Promise.race([font, timeout]);
  await new Promise<void>((resolve) => {
    win.requestAnimationFrame(() => {
      resolve();
    });
  });
  return which;
}

/** Shows the stage once the first screen, laid out in this task, is ready to paint (above). */
export function showWhenLaidOut(
  win: FirstPaintWindow,
  stage: { readonly dataset: Record<string, string | undefined> },
  beforeShow: () => void,
): void {
  void firstPaintReady(win).then(() => {
    showStage(win, stage, beforeShow);
  });
}

/**
 * Shows the stage: `beforeShow` first (the canvas takes its laid-out size, so its first visible
 * draw is at the size it keeps), then the stage; the reload line goes, and a mark notes the moment.
 */
export function showStage(
  win: FirstPaintWindow,
  stage: { readonly dataset: Record<string, string | undefined> },
  beforeShow: () => void,
): void {
  beforeShow();
  delete stage.dataset['booting'];
  win.document.getElementById('boot-fallback')?.remove();
  win.performance.mark(STAGE_SHOWN_MARK, {
    detail: { fontReady: win.document.fonts?.check(FIRST_PAINT_FONT) ?? true },
  });
}
