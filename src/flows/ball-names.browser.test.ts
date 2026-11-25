// One size for every ball name (ADR 0087, amending ADR 0081 requirement 2): every tile's name in the
// Balls grid has the same computed size (12 px), weight 700, and fits its tile on one line, at the
// narrowest phones (320 px), a common one (375 px) and an iPhone (390 px). The page runs in a frame
// whose width the test sets (the viewport itself is never resized in a test).
import { describe, expect, it } from 'vitest';
import { frames } from './page-support.ts';
import { openFramed, waitFor } from './reload-support.ts';

describe('ball names', () => {
  it('are one size and fit their tiles on one line at 320, 375 and 390 px', async () => {
    const framed = await openFramed('?view=manual');
    const names = () => [
      ...framed.doc().querySelectorAll<HTMLElement>('.ball-grid .ball-tile-name'),
    ];
    await waitFor(framed, () => names().length > 0, 5_000, 'the Balls grid');
    for (const width of [320, 375, 390]) {
      framed.frame.style.width = `${String(width)}px`;
      await frames(3, framed.win());
      const win = framed.win();
      const looks = new Set(
        names().map((name) => {
          const style = win.getComputedStyle(name);
          return `${style.fontSize} ${style.fontWeight}`;
        }),
      );
      expect([...looks], `${String(width)} px: one look for every name`).toStrictEqual([
        '12px 700',
      ]);
      const overflowing = names()
        .filter((name) => {
          const lineHeight = Number.parseFloat(win.getComputedStyle(name).lineHeight);
          return (
            name.scrollWidth > name.clientWidth ||
            name.getBoundingClientRect().height > lineHeight * 1.5
          );
        })
        .map((name) => name.textContent);
      expect(overflowing, `${String(width)} px: names cut or wrapped`).toStrictEqual([]);
    }
  });
});
