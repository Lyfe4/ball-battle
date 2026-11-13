// What a reload flow compares (series-reload-flow.ts, ADR 0042): the screen as the player sees it,
// reloaded and compared again, and the check that the bot's hidden balls stay hidden.
import { expect } from 'vitest';
import { loadSeries } from '../app/series-save.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { formatOf, remainingOf } from '../sim/series.ts';
import { frames } from './page-support.ts';
import { paramOf, reload, shown, type Framed } from './reload-support.ts';

export const storage = () => window.localStorage;
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the player sees: the URL, the title, every visible part's words, and the court. */
export interface Screen {
  readonly search: string;
  readonly title: string;
  readonly parts: readonly string[];
  /** The court's size and pixels, where the opening drawn is checked. */
  readonly court?: string;
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
  const drawn =
    court && canvas !== null
      ? `${String(canvas.width)}x${String(canvas.height)} ${canvas.toDataURL()}`
      : undefined;
  return {
    search: framed.win().location.search,
    title: doc.title,
    parts,
    ...(drawn === undefined ? {} : { court: drawn }),
  };
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
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}

/** Reloads and checks the page comes back to `expected` (by default, the screen before it). */
export async function reloadsTo(framed: Framed, where: string, court: boolean, expected?: Screen) {
  const before = expected ?? (await steady(framed, court));
  await reload(framed);
  const end = Date.now() + 15_000;
  let after = screenOf(framed, court);
  while (JSON.stringify(after) !== JSON.stringify(before) && Date.now() < end) {
    await wait(300);
    after = screenOf(framed, court);
  }
  expect({ where, ...after }).toStrictEqual({ where, ...before });
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
