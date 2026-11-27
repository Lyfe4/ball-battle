// The Friends and Ranks tabs on a desktop (ADR 0031, 0081, 0087), at 1280 x 800: a list's main
// column from the frame's left edge and its aside (`--col-aside`, 26rem) at the frame's right edge,
// side by side under the header row that spans the frame, their tops level (the asides, ADR 0087
// addendum of 2026-11-26): never cards stretched across the frame (the 2026-11-24 staging walk) or a
// column centred on its own (which moved the header between screens).
import { describe, expect, it } from 'vitest';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen, openAs } from './shell-routes-support.ts';

const REM = 16;

function boxOf(selector: string): DOMRect {
  const node = visible(selector)[0];
  if (node === undefined) throw new Error(`No ${selector}`);
  return node.getBoundingClientRect();
}

function checkAside(screen: string, main: string, aside: string): void {
  const head = boxOf(`${screen} .screen-header`);
  const left = boxOf(main);
  const right = boxOf(aside);
  expect(Math.abs(left.left - head.left), `${main} from the frame's left edge`).toBeLessThan(1);
  expect(Math.abs(right.right - head.right), `${aside} to the frame's right edge`).toBeLessThan(1);
  expect(Math.round(right.width), `${aside} is the aside's width`).toBe(26 * REM);
  expect(left.right, `${main} beside ${aside}`).toBeLessThan(right.left);
  expect(Math.abs(left.top - right.top), `${main} and ${aside} level`).toBeLessThan(1);
}

describe('the Friends and Ranks tabs on a desktop', () => {
  it('lay a list out as a main column and an aside across the frame', async () => {
    await openAs({ online: true, accounts: true }, '?view=friends');
    await onScreen('friends');
    await until(() => visible('.friends-sign-in-card').length > 0, 5_000, 'the Friends tab');
    // A guest: the card in the friends' place, the link card where an account's sits.
    checkAside('.friends-screen', '.friends-sign-in-card', '.friends-link-card');
    await follow('?view=ranks');
    await onScreen('ranks');
    await settle();
    // Ranks: one card and its way on under it, one column (ADR 0090 addendum), never an aside.
    const card = boxOf('.ranks .soon-card');
    const play = boxOf('.ranks .hud-button');
    expect(Math.abs(card.left - play.left)).toBeLessThan(1);
    expect(play.top).toBeGreaterThan(card.bottom);
  });
});
