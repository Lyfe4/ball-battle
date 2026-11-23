// A button that waits on the server (ADR 0052, 0053): every online action takes a second or more
// (functions in Ohio, the database in Sydney), so the button shows it is working. One component for
// every such button (Send challenge, Accept, Lock in, a pick, Cancel, Leave and forfeit, Forget me,
// Try again, Back to your match). From the tap it is busy (`aria-busy`, a short spoken label, and a
// second tap does nothing); after BUSY_SHOW_MS, so a quick answer never flickers, a small ball
// bounces in place of its words (busy-button.css), the words kept invisible so its size never
// changes. With reduced motion the ball is three still dots.

/** How long a button waits before it shows that it is working. */
export const BUSY_SHOW_MS = 180;

export const isBusy = (button: HTMLElement): boolean => button.getAttribute('aria-busy') === 'true';

/**
 * Holds `button` busy until `work` settles: busy at once, the ball after BUSY_SHOW_MS. `label` is
 * what a screen reader hears meanwhile (by default the button's words and "working").
 */
export async function holdBusy(
  button: HTMLElement,
  work: Promise<unknown>,
  label?: string,
): Promise<void> {
  const named = button.getAttribute('aria-label');
  const words = named ?? button.textContent.trim();
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-label', label ?? `${words}: working…`);
  const ball = document.createElement('span');
  ball.className = 'busy-ball';
  ball.setAttribute('aria-hidden', 'true');
  const show = window.setTimeout(() => {
    button.dataset['busy'] = 'shown';
    button.append(ball);
  }, BUSY_SHOW_MS);
  try {
    await work;
  } finally {
    window.clearTimeout(show);
    ball.remove();
    delete button.dataset['busy'];
    button.removeAttribute('aria-busy');
    if (named === null) button.removeAttribute('aria-label');
    else button.setAttribute('aria-label', named);
  }
}

/**
 * `handler` on every tap of `button`, except while it is busy. A handler that returns a promise
 * (a request) holds the button busy until it settles; one that returns nothing (moving to another
 * screen) doesn't.
 */
export function busyOnClick(
  button: HTMLElement,
  handler: () => unknown,
  label?: () => string | undefined,
): void {
  button.addEventListener('click', () => {
    if (isBusy(button)) return;
    const out = handler();
    if (out instanceof Promise) void holdBusy(button, out, label?.());
  });
}
