// The matchup chart on a touch phone (375 x 812, ADR 0073 addendum of 2026-11-23): the hero, then
// five stacked bands; a tapped chip opens the pair's reason right under its own row (not at the end
// of the page), says it once to a screen reader, and Escape closes it, focus back on the chip.
// Every chip's accessible name says its level and who wins those odds.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { frames } from './page-support.ts';
import {
  box,
  checkBands,
  checkTopAndWidth,
  chips,
  choose,
  detail,
  openChart,
  sideBySide,
} from './spectrum-support.ts';

const LABEL =
  /^[A-Z][\w ]+: [A-Z][\w ]+ (strongly|slightly) (un)?favoured, [A-Z][\w ]+ wins about [67] in 10$|^[A-Z][\w ]+: even with [A-Z][\w ]+, about 1 in 2$/;

describe('the matchup chart on a phone', () => {
  it('stacks five bands and opens a reason under the tapped chip’s row', async () => {
    await openChart();
    checkBands();
    expect(sideBySide(), 'stacked, never columns').toBe(false);
    await checkTopAndWidth('phone');
    expect(
      chips()
        .map((chip) => chip.getAttribute('aria-label') ?? '')
        .filter((label) => !LABEL.test(label)),
    ).toStrictEqual([]);

    // The band with the most chips wraps; tap the first chip of its first row.
    const band = [...document.querySelectorAll<HTMLElement>('.spectrum-band')].sort(
      (a, b) =>
        b.querySelectorAll('.spectrum-chip').length - a.querySelectorAll('.spectrum-chip').length,
    )[0];
    const own = [...(band?.querySelectorAll<HTMLElement>('.spectrum-chip') ?? [])];
    const index = chips().indexOf(own[0] ?? document.body);
    const chip = await choose(index);
    const card = detail();
    if (card === undefined) throw new Error('No reason opened');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(card.closest('.spectrum-band'), 'in the tapped chip’s own band').toBe(band);
    const row = own.filter((one) => Math.abs(box(one).top - box(chip).top) < 4);
    const below = own.filter((one) => box(one).top > box(chip).top + 4);
    expect(box(card).top, 'under the row').toBeGreaterThanOrEqual(
      Math.max(...row.map((one) => box(one).bottom)),
    );
    expect(below.length, 'more rows follow the reason').toBeGreaterThan(0);
    expect(box(card).bottom).toBeLessThanOrEqual(Math.min(...below.map((one) => box(one).top)));
    const status = document.querySelector('.matchup-spectrum [role="status"]');
    expect(status?.textContent).toContain(card.querySelector('h3')?.textContent ?? '?');
    expect(card.querySelector('button')?.textContent).toMatch(/^Open /);

    // Escape closes it, and focus goes back to the chip.
    chip.focus();
    await userEvent.keyboard('{Escape}');
    await frames(2);
    expect(detail()).toBeUndefined();
    expect(document.activeElement).toBe(chip);
  });
});
