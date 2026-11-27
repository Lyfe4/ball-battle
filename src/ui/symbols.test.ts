import { describe, expect, it } from 'vitest';
import { MARKS } from './balls/marks.ts';
import { placeTooltip } from './tooltip-place.ts';
import { SYMBOL_KEYS, SYMBOLS, tooltipLines } from './symbols.ts';

describe('the symbols', () => {
  it('says each matchup mark with the marks every screen draws', () => {
    expect(SYMBOLS.favoured.mark).toBe(MARKS.favoured);
    expect(SYMBOLS.unfavoured.mark).toBe(MARKS.unfavoured);
    expect(SYMBOLS.even.mark).toBe(MARKS.even);
  });

  it('gives the tooltip the legend’s own words, each once, and nothing for a name it lacks', () => {
    expect(tooltipLines(['unfavoured'])).toStrictEqual([SYMBOLS.unfavoured.meaning]);
    expect(tooltipLines(['favoured', 'even', 'favoured', 'typo', undefined])).toStrictEqual([
      SYMBOLS.favoured.meaning,
      SYMBOLS.even.meaning,
    ]);
    for (const key of SYMBOL_KEYS) expect(SYMBOLS[key].meaning.length).toBeGreaterThan(0);
  });
});

describe('placing the tooltip', () => {
  const view = { width: 375, height: 812 };
  const size = { width: 120, height: 24 };

  it('sits centred above the symbol', () => {
    expect(placeTooltip({ left: 100, top: 200, width: 20, height: 20 }, size, view)).toStrictEqual({
      left: 50,
      top: 170,
    });
  });

  it('goes below a symbol at the top of the screen, and stays inside the edges', () => {
    expect(placeTooltip({ left: 0, top: 4, width: 20, height: 20 }, size, view)).toStrictEqual({
      left: 8,
      top: 30,
    });
    expect(placeTooltip({ left: 360, top: 200, width: 14, height: 20 }, size, view).left).toBe(
      375 - 8 - 120,
    );
  });

  it('never covers a coach where the other side has room (ADR 0090 addendum)', () => {
    const coach = { left: 16, top: 120, width: 343, height: 70 };
    const mark = { left: 100, top: 200, width: 20, height: 20 };
    expect(placeTooltip(mark, size, view, [coach]).top).toBe(226);
    // No room below either: above, as before.
    const low = { left: 100, top: 780, width: 20, height: 20 };
    const tall = { left: 0, top: 700, width: 375, height: 90 };
    expect(placeTooltip(low, size, view, [tall]).top).toBe(750);
  });
});
