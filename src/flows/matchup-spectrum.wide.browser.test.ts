// The matchup chart at 1280 x 800 (matchup-spectrum-desktop.ts), and by keyboard alone: Change ball
// opens Free play's grid with focus on the current ball, Enter picks another and focus returns to
// Change ball; Tab reaches the chips, each focus visible; Enter on a chip opens its reason, said
// once; Escape closes it, focus back on the chip, and a second Escape does nothing.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { frames, visible } from './page-support.ts';
import { checkDesktopChart } from './matchup-spectrum-desktop.ts';
import { detail } from './spectrum-support.ts';

const focused = () => document.activeElement as HTMLElement | null;

describe('the matchup chart on a desktop', () => {
  it('lays the bands out as five columns under the reason’s strip', async () => {
    await checkDesktopChart('1280 x 800');
  }, 60_000);

  // The page from the test above, still on the chart (one boot per file).
  it('works by keyboard alone', async () => {
    const change = visible('.spectrum-change')[0];
    const name = () => document.querySelector('.spectrum-hero-name')?.textContent;
    const before = name();
    change?.focus();
    await userEvent.keyboard('{Enter}');
    await frames(2);
    expect(focused()?.closest('.spectrum-chooser'), 'focus in the grid').not.toBeNull();
    expect(focused()?.getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Enter}');
    await frames(2);
    expect(focused()).toBe(change);
    expect(name()).not.toBe(before);

    await userEvent.tab();
    const chip = focused();
    expect(chip?.classList.contains('spectrum-chip'), 'Tab reaches the first chip').toBe(true);
    expect(chip?.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(chip ?? document.body).boxShadow).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await frames(2);
    const status = document.querySelector('.matchup-spectrum [role="status"]');
    const said = status?.textContent ?? '';
    expect(said).toMatch(/ vs /);
    expect(detail()).toBeDefined();
    await userEvent.keyboard('{Escape}');
    await frames(2);
    expect(detail()).toBeUndefined();
    expect(focused()).toBe(chip);
    expect(status?.textContent, 'nothing said on closing').toBe('');
    // Nothing left to close: a second Escape changes nothing.
    await userEvent.keyboard('{Escape}');
    expect(focused()).toBe(chip);
  });
});
