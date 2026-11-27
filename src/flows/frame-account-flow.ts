// One frame for an account (ADR 0087, 0089): the frame walk (frame-anchors-flow.ts) runs as a guest,
// whose Profile is a notice. Signed in with a long history, Profile is two columns on a desktop and
// All matches is its own screen; their header rows sit on the same pixels as the Friends and Ranks
// tabs', and the content still starts at the row's left edge.
import { expect } from 'vitest';
import { ACCOUNT_STORAGE_KEY } from '../app/online-device.ts';
import { headerAnchors } from './frame-anchors-flow.ts';
import { settle, until, visible } from './page-support.ts';
import { RECORD_ANSWERS } from './profile-answers.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

const SAME = 0.5;
const SCREENS = [
  ['Friends', '?view=friends', 'friends'],
  ['Profile', '?view=profile', 'profile'],
  ['All matches', '?view=matches', 'matches'],
  ['Ranks', '?view=ranks', 'ranks'],
] as const;

export async function checkAccountFrame(): Promise<void> {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
  // A phone overlays its scrollbar, so a tall screen and a short one put the header on the same
  // pixels. Firefox's and WebKit's test browsers draw a classic one at phone size, which moved the
  // gear by its width on the screens tall enough to scroll (Friends with its list and code card).
  // As a phone draws it; a desktop's gutter is reserved by base.css and kept.
  if (!matchMedia('(min-aspect-ratio: 5/4) and (pointer: fine)').matches) {
    const overlay = document.createElement('style');
    overlay.textContent = ':root { scrollbar-width: none; }';
    document.head.append(overlay);
  }
  await openAs({ online: true, accounts: true }, '', {
    '/api/v1/me': { name: 'robin_b', account: true, username: 'robin_b' },
    '/api/v1/me/inbox': { friends: [], requests: 0, invites: [], turns: [] },
    // The list answers: without it Friends showed its failure card, and this walk measured a
    // failing screen, not an account's (ADR 0087 addendum of 2026-11-28).
    '/api/v1/friends': { code: '7KQ2M9XD', friends: [], incoming: [], outgoing: [], blocked: [] },
    ...RECORD_ANSWERS,
  });
  await onScreen('home');
  const seen: { name: string; anchors: ReturnType<typeof headerAnchors> }[] = [];
  for (const [name, search, screen] of SCREENS) {
    await follow(search);
    await until(() => screenOn() === screen, 5_000, name, false);
    if (screen === 'profile' || screen === 'matches') {
      await until(() => visible('.profile-match').length > 0, 5_000, `${name}'s matches`, false);
    }
    await settle();
    seen.push({ name, anchors: headerAnchors(name) });
  }
  const first = seen[0];
  if (first === undefined) throw new Error('No screen');
  const off = (a: DOMRect, b: DOMRect) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width));
  for (const { name, anchors } of seen) {
    expect(off(anchors.gear, first.anchors.gear), `the gear on ${name}`).toBeLessThanOrEqual(SAME);
    expect(off(anchors.lead, first.anchors.lead), `the lead on ${name}`).toBeLessThanOrEqual(SAME);
    expect(
      Math.abs(anchors.title.left - first.anchors.title.left),
      `the title on ${name}`,
    ).toBeLessThanOrEqual(SAME);
    expect(anchors.width, `the page's width on ${name}`).toBe(first.anchors.width);
  }
}
