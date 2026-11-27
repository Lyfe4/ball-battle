// One frame (ADR 0087): every screen where nothing fights has the same header row, and at one size
// its parts sit on the same pixels on every screen. The flow opens each such screen in turn (the tab
// screens, a ball's page, the chart, Profile, All matches, sign-in, each setup, a lineup, Free play, the
// older-link notice, a game by turns waiting on the other's pick)
// in a build with accounts and online play (the API refuses everything: no screen waits on a
// server), and reads the header row's boxes.
//
// On every screen: the row's first part is the lead slot, one tap target wide (Back, the avatar, or
// nothing); the title follows it after one gap, one line in the title's size; the gear is the
// row's last control, after any `?`; the content under the row starts at the row's left edge.
// Across screens at one size: the lead slot's box, the title's left and top, the gear's box and the
// row's top differ by no more than half a pixel, and the page's width doesn't change (a scrollbar
// coming and going). With a friend's banner open (ADR 0086) nothing moves: it floats over the row.
import { expect } from 'vitest';
import { firstSeries } from '../app/first-series-device.ts';
import { LATER_NAME } from '../screens/incoming-text.ts';
import { createIncomingBanner } from '../ui/online/incoming-banner.ts';
import { TURNS_SERIES, turnsAnswers } from './online-looks-support.ts';
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
  ['All matches', '?view=matches', 'matches'],
  ['sign-in', '?view=signin', 'signin'],
  ['the vs Bot setup', '?mode=bo3', 'series'],
  // Its lineup is the same task's next screen: the header stays put, the rail too on a PC (ADR 0087
  // addendum of 2026-11-26).
  ['the lineup', '?mode=bo3&fmt=reveal&step=lineup', 'series'],
  ['Free play', '?view=pick', 'pick'],
  ['an older link', '?a=brawler&b=vampire&seed=7&v=1', 'outdated'],
];

/**
 * A brand-new device's Play and lineup (ADR 0090): the guided first visit, in the same frame. The
 * device is made new for them (Show all tips again does it), then skips back to everything.
 */
export const FIRST_VISIT_SCREENS: readonly (readonly [name: string, search: string])[] = [
  ['Play, a first visit', ''],
  ['the first lineup', '?mode=bo3&fmt=reveal&step=lineup'],
];

/**
 * Screens in the frame only with a server's answer: a series by turns between its fights (the
 * 2026-11-27 staging walk found it bare), opened with its answer (online-looks-support.ts).
 */
const ANSWERED_SCREENS: readonly (readonly [name: string, search: string, screen: string])[] = [
  ['a game by turns', `?online=${TURNS_SERIES}`, 'online'],
];

interface Anchors {
  readonly top: number;
  /** The page's width inside any scrollbar: it never changes between screens. */
  readonly width: number;
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

const laidOut = (node: Element): node is HTMLElement =>
  node instanceof HTMLElement && node.getClientRects().length > 0 && !node.hidden;

/** The first part laid out after `node` in its parent (the legend's panel is under the row). */
function nextLaidOut(node: Element): HTMLElement | undefined {
  for (let next = node.nextElementSibling; next !== null; next = next.nextElementSibling) {
    if (laidOut(next)) return next;
  }
  return undefined;
}

/** Checks the row's parts on one screen and returns where they sit. */
export function headerAnchors(where: string, content: 'check' | 'skip' = 'check'): Anchors {
  const head = shownHeader(where);
  const headBox = head.getBoundingClientRect();
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
  // One line in the row's height; a long title wraps to a second rather than losing its end, and
  // only a third is cut (ADR 0087 addendum of 2026-11-27).
  expect(getComputedStyle(title).webkitLineClamp, `${where}: at most two lines`).toBe('2');
  const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
  if (titleBox.height < 1.5 * lineHeight + leadBox.height / 2) {
    expect(
      Math.abs(titleBox.height - leadBox.height),
      `${where}: one line, the row's height`,
    ).toBeLessThanOrEqual(SAME);
  }
  // The row's controls (the legend's panel opens under it): the gear is the last.
  const controls = parts.filter((node) => node.matches('button'));
  const gear = controls.at(-1);
  expect(gear?.classList.contains('settings-toggle'), `${where}: the gear is last`).toBe(true);
  if (gear === undefined) throw new Error(`${where}: no gear`);
  // The content starts where the row does: at the frame's left edge, never a column centred. On
  // Play that is the court where it stands left of the panel (a desktop).
  const court = document.querySelector('.stage[data-home] .arena-container');
  const lefts = [nextLaidOut(head), court !== null && laidOut(court) ? court : undefined]
    .filter((node) => node !== undefined)
    .map((node) => node.getBoundingClientRect().left);
  if (content === 'check' && lefts.length > 0) {
    expect(
      Math.abs(Math.min(...lefts) - headBox.left),
      `${where}: the content starts at the row's left edge`,
    ).toBeLessThanOrEqual(SAME);
  }
  return {
    top: headBox.top,
    width: document.documentElement.clientWidth,
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

const near = (a: number, b: number, what: string): void => {
  expect(Math.abs(a - b), `${what}: ${a.toFixed(1)} against ${b.toFixed(1)}`).toBeLessThanOrEqual(
    SAME,
  );
};

/** What a banner must never move: the header row, what follows it, Play's court, the tab bar. */
function landmarks(where: string): Map<string, DOMRect> {
  const head = shownHeader(where);
  const found = new Map<string, DOMRect>([['the header row', head.getBoundingClientRect()]]);
  const next = nextLaidOut(head);
  if (next !== undefined) found.set('the content under the row', next.getBoundingClientRect());
  for (const [what, selector] of [
    ['the court', '.stage[data-home] .arena-container'],
    ['the tab bar', '.tab-bar'],
  ] as const) {
    const node = document.querySelector(selector);
    if (node !== null && laidOut(node)) found.set(what, node.getBoundingClientRect());
  }
  const page = document.scrollingElement ?? document.documentElement;
  found.set("the page's height", new DOMRect(0, 0, 0, page.scrollHeight));
  return found;
}

/** Opens a friend's challenge banner over the screen on show, checks it moved nothing, and closes it. */
async function bannerMovesNothing(where: string): Promise<void> {
  const before = landmarks(where);
  const root = document.createElement('div');
  document.body.append(root);
  const banner = createIncomingBanner(root, 'A friend’s challenge', {
    accept: () => Promise.resolve(),
    decline: () => Promise.resolve(),
    dismiss: () => undefined,
    later: () => undefined,
  });
  banner.show({
    who: 'Sam_R',
    title: 'Sam_R challenges you',
    line: 'Best of 3 · Reveal · live',
    answers: 'answer',
    later: LATER_NAME,
    left: 1,
  });
  await settle();
  try {
    const after = landmarks(where);
    for (const [what, rect] of before) {
      const moved = after.get(what);
      expect(moved, `${where}: ${what} with a banner open`).toBeDefined();
      if (moved !== undefined) expectSameBox(moved, rect, `${where}: ${what} with a banner open`);
    }
    // A phone held upright: it floats over the header row, inside the safe area.
    if (!matchMedia('(min-aspect-ratio: 5/4)').matches) {
      const head = before.get('the header row');
      const box = root.getBoundingClientRect();
      expect(box.top, `${where}: the banner is over the header row`).toBeLessThan(
        head?.bottom ?? 0,
      );
      expect(box.top, `${where}: the banner keeps off the screen's edge`).toBeGreaterThan(0);
    }
  } finally {
    banner.show(undefined);
    root.remove();
  }
}

export interface FrameChecks {
  /**
   * Where Play's header row is held to the frame: `frame`, all of it (a phone, a desktop: the row
   * runs across the frame's top); `gear`, its gear alone (beside, where the row tops the panel next
   * to the court, ADR 0067, and only the gear keeps to the frame's right edge); `none` until Play's
   * desktop layout joins the frame (plan PR 9).
   */
  readonly play: 'frame' | 'gear' | 'none';
}

/**
 * A browse move mid-transition (ADR 0087, PR 19): Balls → a ball's page rises and fades, but the
 * header row's lead slot and title stay on their pixels every frame, and nothing animates the row
 * or the rail (their View Transition parts are still, screen-motion.css).
 */
async function checkMidTransition(): Promise<void> {
  await follow('?view=manual');
  await onScreen('manual');
  const head = shownHeader('Balls');
  const lead = head.querySelector('.screen-lead')?.getBoundingClientRect();
  const still = (part: string) => /\((screen-head|rail)\)/.test(part);
  const moved: string[] = [];
  history.pushState(null, '', `${location.pathname}?view=manual&ball=vampire`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  for (let frame = 0; frame < 20; frame += 1) {
    await new Promise((done) => requestAnimationFrame(done));
    for (const animation of document.getAnimations()) {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target;
      const pseudo = effect?.pseudoElement ?? '';
      if (still(pseudo) || target?.closest('.screen-header, .tab-bar') != null) {
        moved.push(`frame ${String(frame)}: ${pseudo || (target?.className ?? '')}`);
      }
    }
    const now = visible('.stage .screen-header .screen-lead')[0]?.getBoundingClientRect();
    if (lead !== undefined && now !== undefined && Math.abs(now.left - lead.left) > 1) {
      moved.push(`frame ${String(frame)}: the lead slot at ${String(now.left)}`);
    }
  }
  await onScreen('manual');
  expect(moved, 'the header row and rail mid-transition').toStrictEqual([]);
}

/** Opens every frame screen and checks its header row, and that none of it moves between them. */
export async function checkFrameAnchors(checks: FrameChecks): Promise<void> {
  await openAs({ online: true, accounts: true }, '', turnsAnswers(Date.now()));
  await onScreen('home');
  const seen: { readonly name: string; readonly screen: string; readonly anchors: Anchors }[] = [];
  for (const [name, search, screen] of [...FRAME_SCREENS, ...ANSWERED_SCREENS]) {
    if (search !== '') await follow(search);
    // An online screen is in the frame once its answer is drawn (its header row shown).
    const drawn = () => screen !== 'online' || visible('.turns-head').length > 0;
    await until(() => screenOn() === screen && drawn(), 5_000, name, false);
    await settle();
    const content = screen === 'home' && checks.play !== 'frame' ? 'skip' : 'check';
    seen.push({ name, screen, anchors: headerAnchors(name, content) });
    await bannerMovesNothing(name);
  }
  firstSeries.reset();
  for (const [name, search] of FIRST_VISIT_SCREENS) {
    const screen = search === '' ? 'home' : 'series';
    await follow('?view=manual');
    await follow(search);
    await until(() => screenOn() === screen, 5_000, name, false);
    await settle();
    const content = screen === 'home' && checks.play !== 'frame' ? 'skip' : 'check';
    seen.push({ name, screen, anchors: headerAnchors(name, content) });
  }
  firstSeries.skip();
  const whole = seen.filter((one) => one.screen !== 'home' || checks.play === 'frame');
  const first = whole[0];
  if (first === undefined) throw new Error('No screen to compare');
  for (const { name, screen, anchors } of seen) {
    if (screen === 'home' && checks.play === 'none') continue;
    const than = `${name} than ${first.name}`;
    expect(anchors.width, `the page's width on ${than}`).toBe(first.anchors.width);
    expectSameBox(anchors.gear, first.anchors.gear, `the gear on ${than}`);
    if (screen === 'home' && checks.play === 'gear') continue;
    near(anchors.top, first.anchors.top, `the row's top on ${than}`);
    expectSameBox(anchors.lead, first.anchors.lead, `the lead slot on ${than}`);
    near(anchors.title.left, first.anchors.title.left, `the title's left on ${than}`);
    near(anchors.title.top, first.anchors.title.top, `the title's top on ${than}`);
  }
  await checkMidTransition();
}
