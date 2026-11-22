// The matchup chart on a phone turned sideways (812 x 375 and 667 x 320, the beside layout, ADR 0067;
// ADR 0073 addendum of 2026-11-23): the bands stacked, never the desktop's columns, and the pair's
// reason in a sticky panel beside them, level with the first band; the top whole at scroll 0 and
// nothing scrolling sideways.
import { describe, expect, it } from 'vitest';
import {
  bands,
  box,
  checkBands,
  checkTopAndWidth,
  choose,
  detail,
  openChart,
  sideBySide,
} from './spectrum-support.ts';

describe('the matchup chart sideways', () => {
  it('stacks the bands and puts the reason in a panel beside them', async () => {
    await openChart();
    checkBands();
    expect(sideBySide(), 'stacked, never columns').toBe(false);
    await checkTopAndWidth('sideways');
    const panel = document.querySelector('.spectrum-aside');
    if (panel === null) throw new Error('No panel');
    // Before a tap the panel says what a tap does.
    expect(panel.textContent).toMatch(/^Tap a ball/);
    await choose(3);
    const card = detail();
    if (card === undefined) throw new Error('No reason opened');
    expect(panel.contains(card), 'in the panel, not under the row').toBe(true);
    const first = bands()[0];
    if (first === undefined) throw new Error('No band');
    expect(box(card).left).toBeGreaterThanOrEqual(box(first).right);
    expect(Math.abs(box(panel).top - box(first).top)).toBeLessThan(2);
    await checkTopAndWidth('sideways, a reason open');
  });
});
