// A button waiting on the server (busy-button.ts): busy from the tap (a second tap does nothing, a
// screen reader hears it is working), the bouncing ball only after a moment so a quick answer
// never flickers, its size unchanged, and back as it was once the request settles. A pick does the
// same on the ball tapped while the rest of the grid waits.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../styles/tokens.css';
import './button.css';
import './busy-button.css';
import './series/pick-rows.css';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { BUSY_SHOW_MS, busyOnClick } from './busy-button.ts';
import { createPickRows } from './series/pick-rows.ts';

/** A request the test answers when it chooses. */
function request() {
  let answer: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    answer = resolve;
  });
  return { promise, answer };
}

function button(text: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'hud-button hud-button-primary';
  node.textContent = text;
  document.body.append(node);
  return node;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a button that waits on the server', () => {
  it('is busy from the tap, shows the ball only after a moment, and comes back as it was', async () => {
    const send = button('Send challenge');
    const pending = request();
    busyOnClick(send, () => pending.promise);
    const size = send.getBoundingClientRect();
    send.click();
    expect(send.getAttribute('aria-busy')).toBe('true');
    expect(send.getAttribute('aria-label')).toBe('Send challenge: working…');
    await vi.advanceTimersByTimeAsync(BUSY_SHOW_MS - 20);
    expect(send.querySelector('.busy-ball'), 'no flicker on a quick answer').toBeNull();
    await vi.advanceTimersByTimeAsync(40);
    expect(send.querySelector('.busy-ball')).not.toBeNull();
    const busy = send.getBoundingClientRect();
    expect([busy.width, busy.height]).toStrictEqual([size.width, size.height]);
    expect(getComputedStyle(send).color).toBe('rgba(0, 0, 0, 0)');

    pending.answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(send.querySelector('.busy-ball')).toBeNull();
    expect(send.hasAttribute('aria-busy')).toBe(false);
    expect(send.hasAttribute('aria-label')).toBe(false);
    expect(send.textContent).toBe('Send challenge');
  });

  it('sends one request however many times it is tapped', async () => {
    const accept = button('Accept challenge');
    const pending = request();
    const handler = vi.fn(() => pending.promise);
    busyOnClick(accept, handler);
    accept.click();
    accept.click();
    await vi.advanceTimersByTimeAsync(500);
    accept.click();
    expect(handler).toHaveBeenCalledTimes(1);
    pending.answer();
    await vi.advanceTimersByTimeAsync(0);
    accept.click();
    expect(handler, 'tappable again once answered').toHaveBeenCalledTimes(2);
  });

  it('never shows busy for a tap that only moves to another screen', async () => {
    const home = button('Home');
    busyOnClick(home, () => undefined);
    home.click();
    await vi.advanceTimersByTimeAsync(500);
    expect(home.hasAttribute('aria-busy')).toBe(false);
    expect(home.querySelector('.busy-ball')).toBeNull();
  });

  it('keeps an accessible name it already had, and gives it back', async () => {
    const back = button('Back to your match');
    back.setAttribute('aria-label', 'Back to your match against Player 4195');
    const pending = request();
    busyOnClick(back, () => pending.promise);
    back.click();
    expect(back.getAttribute('aria-label')).toBe(
      'Back to your match against Player 4195: working…',
    );
    pending.answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(back.getAttribute('aria-label')).toBe('Back to your match against Player 4195');
  });
});

describe('a pick that waits on the server', () => {
  it('shows on the ball tapped while the rest of the grid waits', async () => {
    const pending = request();
    const onPick = vi.fn(() => pending.promise);
    const rows = createPickRows(BALL_LOOKUP, onPick);
    document.body.append(rows.element);
    rows.show({ kind: 'open', options: ['archer', 'thorns', 'vampire'], opponents: ['brawler'] });
    const picks = [...rows.element.querySelectorAll<HTMLButtonElement>('.pick-row-pick')];
    picks[0]?.click();
    picks[1]?.click();
    picks[0]?.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('archer');
    await vi.advanceTimersByTimeAsync(BUSY_SHOW_MS + 20);
    expect(picks[0]?.querySelector('.busy-ball')).not.toBeNull();
    expect(picks[0]?.getAttribute('aria-label')).toBe('Picking Archer…');
    expect(getComputedStyle(picks[1]?.closest('.pick-row') ?? document.body).opacity).toBe('0.5');

    pending.answer();
    await vi.advanceTimersByTimeAsync(0);
    picks[1]?.click();
    expect(onPick).toHaveBeenLastCalledWith('thorns');
  });
});
