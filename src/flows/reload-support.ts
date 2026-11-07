// The real page in a frame of its own, so a flow can reload it as a browser does (ADR 0042): the
// test page itself can't reload without ending the test. The frame fills the test's viewport, so
// the page inside is laid out at the project's screen size (375 x 812, 390 x 664, 1280 x 800).
import { expect } from 'vitest';
import { settle } from './page-support.ts';

export interface Framed {
  readonly frame: HTMLIFrameElement;
  win(): Window;
  doc(): Document;
}

const loaded = (frame: HTMLIFrameElement) =>
  new Promise((resolve) => {
    frame.addEventListener('load', resolve, { once: true });
  });

/** Waits until `done`, failing with `what` after `ms`. */
export async function waitFor(done: () => boolean, ms: number, what: string): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await settle();
  }
}

/** The page at `search`, in a frame filling the viewport. */
export async function openFramed(search: string): Promise<Framed> {
  document.body.replaceChildren();
  document.body.style.margin = '0';
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0';
  const framed: Framed = {
    frame,
    win: () => frame.contentWindow ?? expect.fail('No window in the frame'),
    doc: () => frame.contentDocument ?? expect.fail('No document in the frame'),
  };
  frame.src = `/index.html${search}`;
  const ready = loaded(frame);
  document.body.append(frame);
  await ready;
  await settle();
  return framed;
}

/** Opens `search` in the frame, as a fresh visit (a link, or the tab reopened). */
export async function visit(framed: Framed, search: string): Promise<void> {
  const ready = loaded(framed.frame);
  framed.win().location.href = `/index.html${search}`;
  await ready;
  await settle();
}

/** Reloads the page in the frame, as the browser (or Safari, in the background) does. */
export async function reload(framed: Framed): Promise<void> {
  const ready = loaded(framed.frame);
  framed.win().location.reload();
  await ready;
  await settle();
}

/** Goes Back in the frame as the browser does, and waits for the page to show where it lands. */
export async function backIn(framed: Framed): Promise<void> {
  const win = framed.win();
  const landed = new Promise((resolve) => {
    win.addEventListener('popstate', resolve, { once: true });
  });
  win.history.back();
  await landed;
  await settle();
}

/** Elements matching `selector` in the frame that are not hidden. */
export function shown(framed: Framed, selector: string): HTMLElement[] {
  // The frame's elements are of its own realm, so `instanceof HTMLElement` here would be false.
  return [...framed.doc().querySelectorAll<HTMLElement>(selector)].filter(
    (node) => node.closest('[hidden]') === null,
  );
}

/** The visible button named `name` (its text, or its accessible name's start). */
export function buttonIn(framed: Framed, name: string): HTMLButtonElement {
  const found = shown(framed, 'button').find(
    (node) =>
      node.textContent.trim() === name ||
      node.getAttribute('aria-label') === name ||
      node.getAttribute('aria-label')?.startsWith(`${name},`) === true,
  );
  if (found === undefined) throw new Error(`No visible button "${name}"`);
  return found as HTMLButtonElement;
}

export const paramOf = (framed: Framed, key: string) =>
  new URL(framed.win().location.href).searchParams.get(key);

export const seriesPhase = (framed: Framed) =>
  shown(framed, '#series')[0]?.dataset['phase'] ?? 'none';
