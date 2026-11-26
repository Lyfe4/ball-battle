// One button and row system (button.css, 2026-11-26), checked on every screen where nothing fights,
// in every sheet, and in every state the online flows reach (online-looks-support.ts: the card, both
// lobbies, the lineups together, a live fight and its Leave, the end and its rematch, failure and
// offline), signed in with friends (the API answered by the test): a button or a row is at least one
// tap target tall (a compact button's unseen reach counts); its label keeps LABEL_INSET from its
// edges; no two controls, nor a control and a person's disc, come closer than the stack gap; and no
// action is drawn as a link (a text-link button or a bare <summary> that doesn't only go somewhere).
// The 2026-11-26 staging checks found labels touching their edges on Profile and the friend lobby,
// the friend sheet's disc touching its first button, Copy stretched for one word, and the lobby's
// "Also send a link" drawn as a pink link.
import { expect, vi } from 'vitest';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { settle, until, visible } from './page-support.ts';
import { NAVIGATING } from '../ui/text-links-support.ts';
import { FRAME_SCREENS } from './frame-anchors-flow.ts';
import { onStatsSheet, onWhoSheet, RECORD_ANSWERS } from './profile-answers.ts';
import { walkOnline, type OnlineAnswers } from './online-looks-support.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

const TAP = 44;
/** How near a label may come to its control's side edge. */
const LABEL_INSET = 12;
/** Half a pixel: two boxes placed by the same rules. */
const SAME = 0.5;

const FRIENDS = [
  { id: 'f-1', name: 'Jo', status: 'offline' },
  { id: 'f-2', name: 'Robin', status: 'online' },
  { id: 'f-3', name: 'Sam_R', status: 'in_a_match' },
];

/** Signed in as robin_b, with three friends, a request to answer and one sent. */
const SIGNED_IN = {
  '/api/v1/me': { name: 'robin_b', account: true, username: 'robin_b' },
  '/api/v1/me/inbox': { friends: FRIENDS, requests: 1, invites: [], turns: [] },
  '/api/v1/friends': {
    code: '7KQ2M9XD',
    friends: FRIENDS,
    incoming: [{ id: 'r-1', name: 'Morgan' }],
    outgoing: [{ id: 'o-1', name: 'Taylor' }],
    blocked: [],
  },
  ...RECORD_ANSWERS,
};

const laidOut = (node: Element): node is HTMLElement =>
  node instanceof HTMLElement &&
  node.getClientRects().length > 0 &&
  node.closest('[hidden]') === null &&
  // Inside a closed fold, only its summary shows.
  node.closest('details:not([open]) > :not(summary)') === null;

/** Where a control can be pressed: its box, reaching further where a compact one's ::before does. */
function targetOf(control: HTMLElement): DOMRect {
  const box = control.getBoundingClientRect();
  const reach = getComputedStyle(control, '::before');
  if (reach.position !== 'absolute' || reach.content === 'none') return box;
  const top = Math.min(0, Number.parseFloat(reach.top) || 0);
  const bottom = Math.min(0, Number.parseFloat(reach.bottom) || 0);
  return new DOMRect(box.x, box.y + top, box.width, box.height - top - bottom);
}

/** The box a control's own words take, if it has any. */
function labelOf(control: HTMLElement): DOMRect | undefined {
  const range = document.createRange();
  range.selectNodeContents(control);
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
  if (control.textContent.trim() === '' || rects.length === 0) return undefined;
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  return new DOMRect(left, rects[0]?.top ?? 0, right - left, rects[0]?.height ?? 0);
}

/** A control's box as it is seen: with its slab under it (button.css, --press-depth). */
function seenBox(node: HTMLElement): DOMRect {
  const box = node.getBoundingClientRect();
  const slab = node.matches('.hud-button')
    ? Number.parseFloat(getComputedStyle(node).marginBottom)
    : 0;
  return new DOMRect(box.x, box.y, box.width, box.height + slab);
}

/** How far apart two boxes are: negative when they overlap. */
function apart(a: DOMRect, b: DOMRect): number {
  const sideways = Math.max(b.left - a.right, a.left - b.right);
  const across = Math.max(b.top - a.bottom, a.top - b.bottom);
  return Math.max(sideways, across);
}

/** Every break of the system in `scope`: none on a screen that keeps it. */
export function controlProblems(where: string, scope: ParentNode): string[] {
  const gap =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-gap')) ||
    12;
  const controls = [...scope.querySelectorAll('.hud-button, .sheet-row')].filter(laidOut);
  const discs = [...scope.querySelectorAll('.friends-disc-sheet')].filter(laidOut);
  const name = (node: HTMLElement) =>
    `${where}: "${(node.getAttribute('aria-label') ?? node.textContent).trim().slice(0, 30)}"`;
  const problems: string[] = [];
  for (const control of controls) {
    const target = targetOf(control);
    if (target.height < TAP - SAME) {
      problems.push(`${name(control)} is ${target.height.toFixed(1)} px tall`);
    }
    const label = labelOf(control);
    const box = control.getBoundingClientRect();
    if (label !== undefined) {
      const inset = Math.min(label.left - box.left, box.right - label.right);
      if (inset < LABEL_INSET - SAME) {
        problems.push(`${name(control)}'s label is ${inset.toFixed(1)} px from its edge`);
      }
    }
  }
  // An action drawn as a link: a text-link button that isn't one that only goes somewhere, or a
  // <summary> drawn as neither a button nor a row that hides actions (a fold with buttons in it).
  // A <details> that tells more is information on a tap (ADR 0025), not an action.
  const links = [...scope.querySelectorAll('button.text-link, summary')].filter(laidOut);
  for (const link of links) {
    const goes = [...link.classList].some((name) => name in NAVIGATING);
    const drawn = link.matches('.hud-button, .sheet-row');
    const hides = link.matches('summary') && link.parentElement?.querySelector('button') !== null;
    if (!goes && !drawn && (hides || link.matches('button'))) {
      problems.push(`${name(link)} is an action drawn as a link`);
    }
  }
  const parts = [...controls, ...discs];
  for (const [index, one] of parts.entries()) {
    for (const other of parts.slice(index + 1)) {
      if (!controls.includes(one) && !controls.includes(other)) continue;
      if (one.contains(other) || other.contains(one)) continue;
      const distance = apart(seenBox(one), seenBox(other));
      if (distance < gap - SAME) {
        problems.push(`${name(one)} and ${name(other)} are ${distance.toFixed(1)} px apart`);
      }
    }
  }
  return problems;
}

/** The open sheet, or the screen on show. */
function scopeNow(): ParentNode {
  const open = [...document.querySelectorAll('dialog[open]')][0];
  return open ?? document.getElementById('stage') ?? document;
}

/** Opens a person's sheet from their row on Friends and checks it, then closes it. */
async function checkSheet(person: string, problems: string[]): Promise<void> {
  const row = visible('.friends-open').find((node) => node.textContent.includes(person));
  if (row === undefined) throw new Error(`No row for ${person}`);
  row.click();
  await until(() => document.querySelector('dialog[open]') !== null, 5_000, `${person}'s sheet`);
  await settle();
  problems.push(...controlProblems(`${person}'s sheet`, scopeNow()));
  document
    .querySelector('dialog[open]')
    ?.querySelector<HTMLButtonElement>('.close-button')
    ?.click();
  await settle();
}

/**
 * The walk's own budget: every screen, sheet, the settings menu and every online state, about 10 s
 * on an idle machine; Vitest's 5-15 s default ran out on a loaded one (2026-11-27).
 */
export const WALK_TIMEOUT_MS = 60_000;

/**
 * Every frame screen and every person's sheet, signed in with friends; or, as a guest (`signedIn`
 * false), every frame screen as a guest sees it (sign-in, a guest's Friends and Profile). The page
 * loads once per file, so each is a file of its own.
 */
export async function checkControlsLook(signedIn = true): Promise<void> {
  vi.stubEnv('VITE_TURNS', '1');
  if (signedIn) localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
  const api: OnlineAnswers = signedIn ? { ...SIGNED_IN } : {};
  await openAs({ online: true, accounts: true }, '', api);
  await onScreen('home');
  const problems: string[] = [];
  // Signed in, sign-in sends you on: it is the guest walk's.
  const screens = FRAME_SCREENS.filter(([, , screen]) => !signedIn || screen !== 'signin');
  for (const [name, search, screen] of screens) {
    if (search !== '') await follow(search);
    await until(() => screenOn() === screen, 5_000, name, false);
    await settle();
    const people = signedIn && screen === 'friends';
    if (people) await until(() => visible('.friends-open').length > 0, 5_000, 'the friends', false);
    problems.push(...controlProblems(name, scopeNow()));
    if (people) {
      for (const person of ['Robin', 'Jo', 'Sam_R', 'Morgan', 'Taylor']) {
        await checkSheet(person, problems);
      }
    }
    if (signedIn && screen === 'profile') {
      await onStatsSheet(() => {
        problems.push(...controlProblems('Your stats', scopeNow()));
        return Promise.resolve();
      });
    }
  }
  // The settings menu, open over Play (2026-11-27): its rows and switches are controls too.
  await follow('');
  await onScreen('home');
  visible('.settings-toggle')[0]?.click();
  await until(() => visible('#settings-panel').length > 0, 5_000, 'the settings menu', false);
  await settle();
  const menu = visible('#settings-panel')[0];
  if (menu !== undefined) problems.push(...controlProblems('the settings menu', menu));
  visible('.settings-toggle')[0]?.click();
  await settle();
  if (signedIn) {
    await onWhoSheet(() => {
      problems.push(...controlProblems('Who do you want to play?', scopeNow()));
      return Promise.resolve();
    });
  }
  // Every online state, signed in (a guest's are the same screens).
  if (signedIn) {
    await walkOnline(api, (state) => {
      problems.push(...controlProblems(state.name, document.body));
      return Promise.resolve();
    });
  }
  expect(problems).toStrictEqual([]);
}
