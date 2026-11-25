// The lineup by keyboard alone (ADR 0086, the quality bar's keyboard line): Tab reaches the grid and
// then the lineup's button, which stays in the tab order while the tray fills (it said nothing and
// Tab ran off the page while it was `disabled`); the arrows move in the grid, Enter and Space pick,
// the last pick puts focus on the button, and Enter on it starts the series.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle, until } from './page-support.ts';
import { openAs } from './shell-routes-support.ts';

/** The element focus is on: its class and accessible words. */
function focused(): string {
  const node = document.activeElement;
  if (!(node instanceof HTMLElement)) return 'none';
  const words = node.getAttribute('aria-label') ?? node.textContent;
  return `${node.className.split(' ')[0] ?? ''} "${words.trim()}"`;
}

async function press(key: string): Promise<void> {
  await userEvent.keyboard(key);
  await settle();
}

const inStage = () => document.getElementById('stage')?.contains(document.activeElement) === true;
const primary = () =>
  [...document.querySelectorAll('.screen-footer .hud-button-primary')].find(
    (node) => node.getClientRects().length > 0 && node.closest('[hidden]') === null,
  );
const tray = () =>
  [...document.querySelectorAll('.lineup-tray-slot')].map((slot) =>
    slot.getAttribute('aria-label'),
  );

describe('the lineup by keyboard', () => {
  it('is reached, filled and started with keys alone', async () => {
    await openAs({ online: false, accounts: false }, '?mode=bo3&fmt=reveal&step=lineup');
    await until(() => primary() !== undefined, 5_000, 'the lineup', false);

    // Tab from the title reaches the grid, every step on the page.
    const walk: string[] = [];
    for (let step = 0; step < 10 && !focused().startsWith('ball-tile'); step += 1) {
      await press('{Tab}');
      walk.push(focused());
      expect(inStage(), `Tab stays on the page: ${walk.join(' → ')}`).toBe(true);
    }
    expect(focused(), walk.join(' → ')).toMatch(/^ball-tile/);

    // One more Tab: the lineup's button, saying how many are left, and doing nothing yet.
    await press('{Tab}');
    expect(document.activeElement, `Tab from the grid reaches the button, not ${focused()}`).toBe(
      primary(),
    );
    expect(primary()?.getAttribute('aria-disabled')).toBe('true');
    expect(primary()?.textContent).toBe('Pick 3 more');
    await press('{Enter}');
    expect(location.search, 'Enter on an unfinished lineup stays').toContain('step=lineup');

    // Back into the grid: the arrows move, Enter and Space pick.
    await press('{Shift>}{Tab}{/Shift}');
    expect(focused()).toMatch(/^ball-tile/);
    await press('{ArrowRight}');
    await press('{Enter}');
    await press('{ArrowDown}');
    await press(' ');
    expect(tray().filter((slot) => slot?.endsWith('empty') === false)).toHaveLength(2);
    await press('{ArrowLeft}');
    await press('{Enter}');

    // The last pick hands focus to the button, which starts the series.
    expect(document.activeElement, 'the last pick focuses the button').toBe(primary());
    expect(primary()?.getAttribute('aria-disabled')).toBe('false');
    await press('{Enter}');
    await until(
      () => !location.search.includes('step=lineup'),
      5_000,
      'the series to start',
      false,
    );
  });
});
