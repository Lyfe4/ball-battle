// The Friends and Ranks tabs on a desktop (ADR 0031, 0081), at 1280 x 800: lists to read, so each
// keeps the reading width every notice keeps (--sheet-narrow, 36rem), centred in the room beside
// the rail, rather than cards stretched across the sheet (found on the 2026-11-24 staging walk).
import { describe, expect, it } from 'vitest';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen, openAs } from './shell-routes-support.ts';

const REM = 16;

function checkSheet(selector: string): void {
  const root = visible(selector)[0];
  if (root === undefined) throw new Error(`No ${selector}`);
  const box = root.getBoundingClientRect();
  const panel = root.parentElement?.getBoundingClientRect();
  if (panel === undefined) throw new Error('No panel');
  expect(Math.round(box.width), selector).toBeLessThanOrEqual(36 * REM);
  // Centred in the sheet beside the rail.
  const left = box.left - panel.left;
  const right = panel.right - box.right;
  expect(Math.abs(left - right), `${selector} centred`).toBeLessThan(2);
  expect(left, `${selector} has room either side`).toBeGreaterThan(REM);
}

describe('the Friends and Ranks tabs on a desktop', () => {
  it('keep the reading width, centred', async () => {
    await openAs({ online: true, accounts: true }, '?view=friends');
    await onScreen('friends');
    await until(() => visible('.friends-card').length > 0, 5_000, 'the Friends tab');
    checkSheet('.friends-screen');
    await follow('?view=ranks');
    await onScreen('ranks');
    await settle();
    checkSheet('.ranks-screen');
  });
});
