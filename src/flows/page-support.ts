// Helpers for flows through the real page (`*.browser.test.ts`, ADR 0025): wait for the page,
// find what a player can see, and go Back as a browser does.
export const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * Resolves after `count` animation frames of `win`: real chances for the page to lay out and draw,
 * however long a loaded browser takes to give them. The arena asks for its next frame while
 * drawing this one, so by the time a frame's callback here runs, the arena has drawn that frame.
 */
export async function frames(count: number, win: Window = window): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => win.requestAnimationFrame(resolve));
  }
}

/**
 * What `read` gives once it holds still from one animation frame to the next: the court once the
 * ready moment's pop-in has played, a layout once it has been sized. Counted in frames, not
 * milliseconds, so a stalled browser can't make a picture mid-animation look settled. Fails
 * after `ms` if it never comes to rest.
 */
export async function atRest(
  read: () => string,
  ms = 15_000,
  win: Window = window,
): Promise<string> {
  const end = Date.now() + ms;
  let last = read();
  for (;;) {
    await frames(1, win);
    const now = read();
    if (now === last) return now;
    if (Date.now() > end) throw new Error('The page never came to rest');
    last = now;
  }
}

/**
 * True when `read` changes within `ms` and at least `looks` looks, each after a real animation
 * frame and at least 100 ms apart; false when it holds still that long. Both bounds must pass
 * before "still" is believed, so a browser too busy to draw can't pass for a court standing still,
 * nor fail one that would have moved.
 */
export async function changes(
  read: () => string | undefined,
  ms: number,
  looks = 10,
): Promise<boolean> {
  const before = read();
  const end = Date.now() + ms;
  for (let look = 0; look < looks || Date.now() < end; look += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await frames(1);
    if (read() !== before) return true;
  }
  return false;
}

/** Goes Back as a browser does, and waits for the page to show the screen it lands on. */
export async function back(): Promise<void> {
  const landed = new Promise((resolve) => {
    window.addEventListener('popstate', resolve, { once: true });
  });
  history.back();
  await landed;
  await settle();
}

export function visible(selector: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (node) => node.closest('[hidden]') === null && !node.hidden,
  );
}

export function button(name: string): HTMLButtonElement {
  const found = visible('button').find(
    (node) =>
      node.textContent.trim() === name ||
      node.getAttribute('aria-label') === name ||
      node.getAttribute('aria-label')?.startsWith(`${name},`) === true,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`No visible button "${name}"`);
  return found;
}

/** Presses Fight! if a match waits on its ready moment (ADR 0037); true when it did. */
export function pressFight(): boolean {
  const fight = visible('.ready-fight')[0];
  fight?.click();
  return fight !== undefined;
}

/**
 * Waits until `done`, failing after `ms` with `what` it waited for and where the page was. A match
 * waiting on its ready moment is started, as a player would, unless `fight` is false.
 */
export async function until(
  done: () => boolean,
  ms: number,
  what: string,
  fight = true,
): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) {
      const phase = document.querySelector<HTMLElement>('#series')?.dataset['phase'] ?? 'none';
      const page = location.search || '(home)';
      throw new Error(
        `Timed out after ${String(ms)} ms waiting for ${what}; page ${page}, series phase ${phase}, visibility ${document.visibilityState}`,
      );
    }
    if (fight) pressFight();
    await settle();
  }
}
