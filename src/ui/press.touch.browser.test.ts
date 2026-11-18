// A finger's tap shows on the control it presses (press.ts, playtest 2026-11-19), with real taps on a
// touch phone in Chromium, Firefox and WebKit: the button lights as its hover does with a mouse
// ("Leave series" turns pink), long enough to be seen, then goes back; it never stays lit after
// the tap, and a finger that starts a scroll over a button doesn't light it.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import '../style.css';
import { installPressFeedback, PRESS_SHOWN_MS } from './press.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    tap: (selector: string) => Promise<void>;
  }
}

beforeAll(() => {
  installPressFeedback();
});
afterEach(() => {
  document.body.replaceChildren();
});

function control(className: string, text: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = text;
  document.body.append(node);
  return node;
}

/** What `node` looked like when it was lit, and for how long it stayed lit (ms). */
function watch(node: HTMLElement, property: string) {
  const seen = { lit: undefined as string | undefined, litAt: 0, unlitAt: 0 };
  // Read each frame while lit, so a transition into the look has settled by the last reading.
  const look = () => {
    if (!node.hasAttribute('data-pressed')) return;
    seen.lit = getComputedStyle(node).getPropertyValue(property);
    requestAnimationFrame(look);
  };
  new MutationObserver(() => {
    if (node.hasAttribute('data-pressed')) {
      seen.litAt = performance.now();
      look();
    } else if (seen.litAt > 0) seen.unlitAt = performance.now();
  }).observe(node, { attributes: true, attributeFilter: ['data-pressed'] });
  return seen;
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('a tap on a touch phone', () => {
  it('lights a button as its hover does, long enough to see, then lets it go', async () => {
    const send = control('hud-button hud-button-primary', 'Send challenge');
    const resting = getComputedStyle(send).filter;
    const seen = watch(send, 'filter');
    await commands.tap('.hud-button');
    await wait(PRESS_SHOWN_MS + 250);
    expect(resting).toBe('none');
    expect(seen.lit).toBe('brightness(1.08)');
    expect(seen.unlitAt - seen.litAt).toBeGreaterThanOrEqual(PRESS_SHOWN_MS - 20);
    expect(send.hasAttribute('data-pressed'), 'never stuck lit').toBe(false);
    expect(getComputedStyle(send).filter).toBe('none');
  });

  it('turns Leave series pink, as a mouse pointing at it does', async () => {
    const leave = control('text-link series-leave', 'Leave series');
    const section = document.createElement('section');
    section.className = 'series';
    section.append(leave);
    document.body.append(section);
    const muted = getComputedStyle(leave).color;
    const seen = watch(leave, 'color');
    await commands.tap('.series-leave');
    await wait(PRESS_SHOWN_MS + 250);
    const pink = getComputedStyle(document.documentElement).getPropertyValue('--color-focus');
    const probe = document.createElement('span');
    probe.style.color = pink;
    document.body.append(probe);
    expect(seen.lit).toBe(getComputedStyle(probe).color);
    expect(seen.lit).not.toBe(muted);
    expect(getComputedStyle(leave).color).toBe(muted);
  });

  it('leaves a disabled button and a scroll alone', async () => {
    const off = control('hud-button', 'Off');
    off.disabled = true;
    const seen = watch(off, 'filter');
    // Playwright won't tap a disabled button: the pointer events a finger's tap makes.
    const touch = { bubbles: true, pointerType: 'touch', isPrimary: true, pointerId: 7 };
    off.dispatchEvent(new PointerEvent('pointerdown', touch));
    off.dispatchEvent(new PointerEvent('pointerup', touch));
    await wait(PRESS_SHOWN_MS);
    expect(seen.lit).toBeUndefined();

    // A finger that turns into a scroll: the browser cancels the pointer before anything lights.
    const on = control('hud-button', 'On');
    const scrolled = watch(on, 'filter');
    on.dispatchEvent(new PointerEvent('pointerdown', touch));
    on.dispatchEvent(new PointerEvent('pointercancel', touch));
    await wait(PRESS_SHOWN_MS);
    expect(scrolled.lit).toBeUndefined();
    expect(on.hasAttribute('data-pressed')).toBe(false);
  });
});
