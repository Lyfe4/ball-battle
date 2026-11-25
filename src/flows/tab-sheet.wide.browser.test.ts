// The Friends and Ranks tabs on a desktop (ADR 0031, 0081, 0087), at 1280 x 800: lists to read, so
// each keeps a list's width (`--col-list`, 36rem) from the frame's left edge, under the header row
// that spans the frame, rather than cards stretched across it (the 2026-11-24 staging walk) or a
// column centred on its own (which moved the header between screens).
import { describe, expect, it } from 'vitest';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen, openAs } from './shell-routes-support.ts';

const REM = 16;

function checkList(selector: string): void {
  const root = visible(selector)[0];
  if (root === undefined) throw new Error(`No ${selector}`);
  const head = root.querySelector('.screen-header')?.getBoundingClientRect();
  if (head === undefined) throw new Error(`No header in ${selector}`);
  const cards = [...root.children]
    .filter((node) => !node.matches('.screen-header') && node.getClientRects().length > 0)
    .map((node) => node.getBoundingClientRect());
  expect(cards.length, selector).toBeGreaterThan(0);
  for (const card of cards) {
    expect(Math.round(card.width), selector).toBeLessThanOrEqual(36 * REM);
    expect(Math.abs(card.left - head.left), `${selector} from the frame's left edge`).toBeLessThan(
      1,
    );
  }
  // The header row spans the frame: wider than the list, its gear far to the right.
  expect(head.width, `${selector}'s header spans the frame`).toBeGreaterThan(36 * REM);
}

describe('the Friends and Ranks tabs on a desktop', () => {
  it('keep a list’s width from the frame’s left edge', async () => {
    await openAs({ online: true, accounts: true }, '?view=friends');
    await onScreen('friends');
    await until(() => visible('.friends-card').length > 0, 5_000, 'the Friends tab');
    checkList('.friends-screen');
    await follow('?view=ranks');
    await onScreen('ranks');
    await settle();
    checkList('.ranks-screen');
  });
});
