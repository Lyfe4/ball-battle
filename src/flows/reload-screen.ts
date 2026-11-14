// What a reload flow compares (series-reload-flow.ts, ADR 0042): the screen as the player sees it,
// reloaded and compared again, and the check that the bot's hidden balls stay hidden.
import { expect } from 'vitest';
import { loadSeries } from '../app/series-save.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { formatOf, remainingOf } from '../sim/series.ts';
import { courtDifference, sameCourt, type Court } from './court-compare.ts';
import { frames } from './page-support.ts';
import { paramOf, reload, shown, type Framed } from './reload-support.ts';

export const storage = () => window.localStorage;
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the player sees: the URL, the title, every visible part's words, and the court. */
export interface Screen {
  readonly search: string;
  readonly title: string;
  readonly parts: readonly string[];
  /** The court's size and pixels, where the opening drawn is checked (court-compare.ts). */
  readonly court?: Court;
}

/** The parts of the page a series screen is made of. The Winner sticker (see-through between rounds, ADR 0033) is left out. */
export const PARTS = [
  '#series-setup',
  '#series',
  '#series-exit',
  '#hud-status',
  '#hud-speed',
  '.ready-layer',
];

export function screenOf(framed: Framed, court: boolean): Screen {
  const doc = framed.doc();
  const parts = PARTS.map((selector) => {
    const part = doc.querySelector<HTMLElement>(selector);
    if (part?.closest('[hidden]') !== null) return `${selector}: -`;
    return `${selector}: ${part.innerText.replace(/\s+/g, ' ').trim()}`;
  });
  const canvas = doc.querySelector<HTMLCanvasElement>('#arena');
  const context = court ? canvas?.getContext('2d') : undefined;
  const drawn: Court | undefined =
    canvas !== null && context !== undefined && context !== null
      ? {
          size: `${String(canvas.width)}x${String(canvas.height)}`,
          // A court not laid out yet (a phone between screens) is 0 wide: no pixels to read.
          pixels:
            canvas.width === 0 || canvas.height === 0
              ? []
              : context.getImageData(0, 0, canvas.width, canvas.height).data,
        }
      : undefined;
  return {
    search: framed.win().location.search,
    title: doc.title,
    parts,
    ...(drawn === undefined ? {} : { court: drawn }),
  };
}

const words = (screen: Screen) => ({
  search: screen.search,
  title: screen.title,
  parts: screen.parts,
});

/** The same words exactly, and the same court within court-compare.ts's tolerance. */
export function sameScreen(a: Screen, b: Screen): boolean {
  if (JSON.stringify(words(a)) !== JSON.stringify(words(b))) return false;
  if (a.court === undefined || b.court === undefined) return a.court === b.court;
  return sameCourt(a.court, b.court);
}

/** A screen as an assertion compares it: the words, and how far its court is from `expected`'s. */
function compared(screen: Screen, expected: Screen) {
  if (screen.court === undefined || expected.court === undefined) {
    return { ...words(screen), court: screen.court === expected.court ? 'same' : 'missing' };
  }
  const { differing, worst } = courtDifference(screen.court, expected.court);
  const court = sameCourt(screen.court, expected.court)
    ? 'same'
    : `${screen.court.size}: ${String(differing)} pixels differ, by up to ${String(worst)}`;
  return { ...words(screen), court };
}

/**
 * Waits for the screen to stop changing (the ready moment's pop-in, a layout settling): the same
 * twice, 400 ms and at least two drawn frames apart. Frames, not only time: a loaded browser can
 * draw nothing for 400 ms, and the court mid-pop-in would then pass for settled.
 */
export async function steady(framed: Framed, court: boolean): Promise<Screen> {
  let last = screenOf(framed, court);
  for (let tries = 0; tries < 40; tries += 1) {
    await wait(400);
    await frames(2, framed.win());
    const now = screenOf(framed, court);
    if (sameScreen(now, last)) return now;
    last = now;
  }
  return last;
}

/** Reloads and checks the page comes back to `expected` (by default, the screen before it). */
export async function reloadsTo(framed: Framed, where: string, court: boolean, expected?: Screen) {
  const before = expected ?? (await steady(framed, court));
  await reload(framed);
  // Long enough for a busy browser: the page puts the series back at once, but "How it was won" is
  // worked out between frames (match-story-teller.ts), and a loaded engine runs those late. It
  // returns as soon as the screen matches.
  const end = Date.now() + 45_000;
  let after = screenOf(framed, court);
  while (!sameScreen(after, before) && Date.now() < end) {
    await wait(300);
    after = screenOf(framed, court);
  }
  expect({ where, ...compared(after, before) }).toStrictEqual({
    where,
    ...compared(before, before),
  });
  return before;
}

/**
 * In Blind the bot's balls stay hidden until each round starts (ADR 0017): none it hasn't played
 * yet is in the URL, the page's words or any accessible name, unless the player has it too.
 */
export function checkBotHidden(framed: Framed, where: string): void {
  const session = loadSeries(storage, BALL_LOOKUP);
  if (session === undefined || formatOf(session.state.setup) !== 'blind') return;
  if (session.state.winner !== undefined) return;
  const { state, current } = session;
  const hidden = remainingOf(state, 'b').filter(
    (id) => id !== current?.b && !state.setup.a.includes(id),
  );
  const doc = framed.doc();
  const said = [
    framed.win().location.href,
    doc.body.innerText,
    ...shown(framed, '[aria-label], [title]').map(
      (node) => `${node.getAttribute('aria-label') ?? ''} ${node.getAttribute('title') ?? ''}`,
    ),
  ].join(' ');
  const named = hidden.filter(
    (id) => said.includes(id) || said.includes(BALL_LOOKUP.get(id)?.name ?? id),
  );
  expect({ where, named, lineupInUrl: paramOf(framed, 'lb') }).toStrictEqual({
    where,
    named: [],
    lineupInUrl: null,
  });
}

export function tapBall(framed: Framed, id: string): void {
  const name = BALL_LOOKUP.get(id)?.name;
  const tile = shown(framed, '.lineup-step .ball-tile').find((node) =>
    node.textContent.includes(name ?? id),
  );
  if (tile === undefined) throw new Error(`No tile for ${id}`);
  tile.click();
}

export const fightShown = (framed: Framed) => shown(framed, '.ready-fight').length === 1;
