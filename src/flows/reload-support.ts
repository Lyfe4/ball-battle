// The real page in a frame of its own, so a flow can reload it as a browser does (ADR 0042): the
// test page itself can't reload without ending the test. The frame fills the test's viewport, so
// the page inside is laid out at the project's screen size (375 x 812, 390 x 664, 1280 x 800).
import { expect } from 'vitest';
import { seedUsed } from './fixed-seed.ts';
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

/** How long the page may give no animation frame before a wait stops believing it will. */
export const NO_FRAMES_MS = 10_000;

/**
 * Waits until `done`, failing after `ms`. It asks the page in the frame for an animation frame on
 * every look, and fails early once none has come for NO_FRAMES_MS: a page that draws nothing
 * plays nothing, so waiting out the rest of `ms` would only hide that. Either failure names
 * `what` it was waiting for and the page's state (stateOf).
 */
export async function waitFor(
  framed: Framed,
  done: () => boolean,
  ms: number,
  what: string,
): Promise<void> {
  const start = Date.now();
  const drawn: number[] = [start];
  const fail = (why: string) => new Error(`${why} waiting for ${what}; ${stateOf(framed, drawn)}`);
  while (!done()) {
    const now = Date.now();
    if (now - start > ms) throw fail(`Timed out after ${String(ms)} ms`);
    if (now - (drawn.at(-1) ?? start) > NO_FRAMES_MS) {
      throw fail(`The page drew no frame for ${String(NO_FRAMES_MS)} ms`);
    }
    framed.win().requestAnimationFrame(() => drawn.push(Date.now()));
    await settle();
  }
}

/** What a wait's failure reports: where the series was, and whether the page was drawing. */
function stateOf(framed: Framed, drawn: readonly number[]): string {
  const doc = framed.doc();
  const series = doc.querySelector<HTMLElement>('#series');
  const score = shown(framed, '.series-bar-score-text, .series-track-score')[0]?.textContent;
  const lastSecond = drawn.filter((at) => Date.now() - at <= 1000).length;
  return [
    `page ${framed.win().location.search || '(home)'}`,
    `series phase ${series?.dataset['phase'] ?? 'none'}`,
    `score ${score?.trim() ?? 'none'}`,
    `visibility ${doc.visibilityState}`,
    `frames seen in the last second ${String(lastSecond)}`,
    `seed ${seedUsed()}`,
  ].join(', ');
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
