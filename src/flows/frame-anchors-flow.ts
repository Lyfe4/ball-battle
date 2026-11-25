// One frame (ADR 0087): every screen where nothing fights has the same header row, and at one size
// its parts sit on the same pixels on every screen. The flow opens each such screen in turn (the tab
// screens, a ball's page, the chart, Profile, sign-in, each setup, Free play, the older-link notice)
// in a build with accounts and online play (the API refuses everything: no screen waits on a
// server), and reads the header row's boxes.
//
// On every screen: the row's first part is the lead slot, one tap target wide (Back, the avatar, or
// nothing); the title follows it after one gap, one line in the title's size; the gear is the
// row's last control, after any `?`. Across screens at one size: the lead slot's box, the title's
// left and top, the gear's box and the row's top differ by no more than half a pixel.
import { expect } from 'vitest';
import { settle, until, visible } from './page-support.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

/** Half a pixel: a box placed by the same rules lands on the same pixel. */
const SAME = 0.5;

/** Every screen where nothing fights, by the URL a player reaches it with, and its screen key. */
export const FRAME_SCREENS: readonly (readonly [name: string, search: string, screen: string])[] = [
  ['Play', '', 'home'],
  ['Balls', '?view=manual', 'manual'],
  ['the matchup chart', '?view=manual&tab=chart', 'manual'],
  ['a ball', '?view=manual&ball=vampire', 'manual'],
  ['Friends', '?view=friends', 'friends'],
  ['Ranks', '?view=ranks', 'ranks'],
  ['Profile', '?view=profile', 'profile'],
  ['sign-in', '?view=signin', 'signin'],
  ['the vs Bot setup', '?mode=bo3', 'series'],
  ['the vs Friend setup', '?view=send&fmt=reveal&mode=bo3', 'send'],
  ['Free play', '?view=pick', 'pick'],
  ['an older link', '?a=brawler&b=vampire&seed=7&v=1', 'outdated'],
];

interface Anchors {
  readonly top: number;
  readonly lead: DOMRect;
  readonly title: DOMRect;
  readonly gear: DOMRect;
}

/** The header row on show: the one laid out on the page. */
function shownHeader(where: string): HTMLElement {
  const heads = visible('.screen-header').filter((node) => node.getClientRects().length > 0);
  expect(heads, `${where}: one header row`).toHaveLength(1);
  const head = heads[0];
  if (head === undefined) throw new Error(`${where}: no header row`);
  return head;
}

const laidOut = (node: Element): boolean =>
  node instanceof HTMLElement && node.getClientRects().length > 0 && !node.hidden;

/** Checks the row's parts on one screen and returns where they sit. */
export function headerAnchors(where: string): Anchors {
  const head = shownHeader(where);
  const parts = [...head.children].filter(laidOut);
  const lead = parts[0];
  expect(lead?.classList.contains('screen-lead'), `${where}: the lead slot comes first`).toBe(true);
  const title = head.querySelector('.screen-title');
  if (lead === undefined || title === null) throw new Error(`${where}: no lead slot or title`);
  const leadBox = lead.getBoundingClientRect();
  const titleBox = title.getBoundingClientRect();
  expect(leadBox.width, `${where}: the lead slot is one tap target wide`).toBe(44);
  expect(parts[1], `${where}: the title follows the lead slot`).toBe(title);
  const gap = Number.parseFloat(getComputedStyle(head).columnGap);
  expect(
    Math.abs(titleBox.left - leadBox.right - gap),
    `${where}: one gap after the lead`,
  ).toBeLessThanOrEqual(SAME);
  expect(getComputedStyle(title).fontSize, `${where}: the title's size`).toBe('22px');
  expect(getComputedStyle(title).whiteSpace, `${where}: the title is one line`).toBe('nowrap');
  // The row's controls (the legend's panel opens under it): the gear is the last.
  const controls = parts.filter((node) => node.matches('button'));
  const gear = controls.at(-1);
  expect(gear?.classList.contains('settings-toggle'), `${where}: the gear is last`).toBe(true);
  if (gear === undefined) throw new Error(`${where}: no gear`);
  return {
    top: head.getBoundingClientRect().top,
    lead: leadBox,
    title: titleBox,
    gear: gear.getBoundingClientRect(),
  };
}

const box = (rect: DOMRect): string =>
  `${rect.x.toFixed(1)},${rect.y.toFixed(1)} ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`;

function expectSameBox(a: DOMRect, b: DOMRect, what: string): void {
  const off = Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );
  expect(off, `${what}: ${box(a)} against ${box(b)}`).toBeLessThanOrEqual(SAME);
}

export interface FrameChecks {
  /** The parts must also sit on the same pixels on every screen (all sizes once the frame is in). */
  readonly across: boolean;
}

/** Opens every frame screen and checks its header row (and, with `across`, that none moves). */
export async function checkFrameAnchors(checks: FrameChecks): Promise<void> {
  await openAs({ online: true, accounts: true }, '');
  await onScreen('home');
  let first: { readonly name: string; readonly anchors: Anchors } | undefined;
  for (const [name, search, screen] of FRAME_SCREENS) {
    if (search !== '') await follow(search);
    await until(() => screenOn() === screen, 5_000, name, false);
    await settle();
    const anchors = headerAnchors(name);
    if (!checks.across) continue;
    if (first === undefined) {
      first = { name, anchors };
      continue;
    }
    const than = `${name} than ${first.name}`;
    expect(
      Math.abs(anchors.top - first.anchors.top),
      `the row's top on ${than}`,
    ).toBeLessThanOrEqual(SAME);
    expectSameBox(anchors.lead, first.anchors.lead, `the lead slot on ${than}`);
    expectSameBox(anchors.gear, first.anchors.gear, `the gear on ${than}`);
    expect(
      Math.abs(anchors.title.left - first.anchors.title.left),
      `the title's left on ${than}`,
    ).toBeLessThanOrEqual(SAME);
    expect(
      Math.abs(anchors.title.top - first.anchors.title.top),
      `the title's top on ${than}`,
    ).toBeLessThanOrEqual(SAME);
  }
}
