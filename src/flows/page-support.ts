// Helpers for flows through the real page (`*.browser.test.ts`, ADR 0025): wait for the page,
// find what a player can see, and go Back as a browser does.
export const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

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
 * Waits until `done`, failing after `ms`. A match waiting on its ready moment is started, as a
 * player would, unless `fight` is false.
 */
export async function until(done: () => boolean, ms: number, fight = true): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the page');
    if (fight) pressFight();
    await settle();
  }
}
