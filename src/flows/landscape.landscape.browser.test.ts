// A phone turned sideways (812 x 375 with touch, the browsers-landscape project): the beside layout
// (ADR 0067), the court at the screen's full height with the panel beside it. Neither the phone
// column (which would squeeze the court to nothing) nor the desktop sheet. Home's demo and a Free
// play fight: the court whole on screen, the panel to its right, both health bars and the speed
// control on screen mid-fight, and nothing scrolls sideways.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { atRest, button, frames, settle, until, visible } from './page-support.ts';

const BESIDE = '(min-aspect-ratio: 5/4)';
const DESKTOP = '(min-width: 64rem) and (min-aspect-ratio: 5/4)';

const box = (node: Element | null | undefined) => {
  if (node === null || node === undefined) throw new Error('Missing part');
  return node.getBoundingClientRect();
};

/** The court's full height: the stage's, less its padding. */
function availableHeight(): number {
  const stage = document.getElementById('stage');
  if (stage === null) throw new Error('No stage');
  const style = getComputedStyle(stage);
  return stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
}

/** The court whole on screen at the stage's full height, the panel beside it, no sideways scroll. */
async function checkBeside(where: string, panel: Element | null | undefined): Promise<void> {
  await frames(2);
  const court = () => box(document.getElementById('arena'));
  await atRest(() => `${String(court().width)} x ${String(court().height)}`);
  const c = court();
  const p = box(panel);
  expect({
    where,
    onScreen: c.top >= 0 && c.left >= 0 && c.bottom <= window.innerHeight,
    fullHeight: Math.abs(c.height - availableHeight()) <= 2,
    panelBeside: p.left >= c.right,
    sideways: document.documentElement.scrollWidth > window.innerWidth,
  }).toStrictEqual({ where, onScreen: true, fullHeight: true, panelBeside: true, sideways: false });
}

describe('a phone turned sideways', () => {
  it('keeps the court at full height with the panel beside it, on home and mid-fight', async () => {
    expect(matchMedia(BESIDE).matches, 'the beside layout').toBe(true);
    expect(matchMedia(DESKTOP).matches, 'not the desktop sheet').toBe(false);
    window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    history.replaceState(null, '', location.pathname);
    await import('../main.ts');
    await settle();

    await checkBeside('home', document.getElementById('home'));

    await userEvent.click(button('Free play'));
    await settle();
    await userEvent.click(button('Start match'));
    await until(() => visible('.ready-card').length === 1, 10_000, 'the ready card', false);
    await userEvent.click(button('Fight!'));
    await settle();
    const parts = [...visible('.hud-ball'), visible('#hud-speed')[0]];
    expect(
      parts.filter((part) => part !== undefined),
      'health bars and speed',
    ).toHaveLength(3);
    const outside = parts.filter((part) => {
      const b = box(part);
      return b.top < 0 || b.bottom > window.innerHeight;
    });
    expect(outside, 'mid-fight, everything on screen').toHaveLength(0);
    await checkBeside('Free play fight', visible('.hud-ball')[0]);
  }, 120_000);
});
