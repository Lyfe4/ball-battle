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

/** The CSS transition `node` runs into `property`'s new value, if any. */
function transitionOf(node: HTMLElement, property: string): CSSTransition | undefined {
  return node
    .getAnimations()
    .find(
      (a): a is CSSTransition => a instanceof CSSTransition && a.transitionProperty === property,
    );
}

/**
 * The look `node` is taking for `property`, and how long it takes to get there (ms; 0 when already
 * there). A transition is read by where it ends, never sampled part-way: a computed style
 * mid-transition advances only when the page renders, and a busy CI machine can render nothing for
 * over 100 ms, which read the 120 ms transitions part-way, into the look (brightness(1.069)) and
 * back out of it (brightness(1.009)).
 */
function lookOf(node: HTMLElement, property: string) {
  // Reading the style starts any transition into the new look.
  const now = getComputedStyle(node).getPropertyValue(property);
  const effect = transitionOf(node, property)?.effect;
  if (!(effect instanceof KeyframeEffect)) return { look: now, settleMs: 0 };
  const frames = effect.getKeyframes();
  const end = frames[frames.length - 1]?.[property];
  const timing = effect.getComputedTiming();
  return {
    look: typeof end === 'string' ? end : now,
    settleMs: (timing.delay ?? 0) + Number(timing.duration ?? 0),
  };
}

/** The look `node` takes when lit, how long it takes to get there, and how long it stayed lit (ms). */
function watch(node: HTMLElement, property: string) {
  const seen = { lit: undefined as string | undefined, settleMs: 0, litAt: 0, unlitAt: 0 };
  new MutationObserver(() => {
    if (node.hasAttribute('data-pressed')) {
      seen.litAt = performance.now();
      const { look, settleMs } = lookOf(node, property);
      seen.lit = look;
      seen.settleMs = settleMs;
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
    // The whole look shows while lit: the transition into it ends before the light goes.
    expect(seen.settleMs).toBeGreaterThan(0);
    expect(seen.settleMs).toBeLessThan(PRESS_SHOWN_MS);
    expect(seen.unlitAt - seen.litAt).toBeGreaterThanOrEqual(PRESS_SHOWN_MS - 20);
    expect(send.hasAttribute('data-pressed'), 'never stuck lit').toBe(false);
    expect(lookOf(send, 'filter').look).toBe('none');
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
    expect(lookOf(leave, 'color').look).toBe(muted);
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
