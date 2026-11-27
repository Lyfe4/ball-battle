// Never waiting without feedback (ADR 0087 addendum of 2026-11-27): every screen a signed-in player
// reaches, walked with the API slowed to SLOW_MS a call, cold (nothing read this visit) and warm (a
// second visit to each), and again with every call failing. A screen fails when, SHOWN_BY after it
// showed, its content area is empty (no words, no picture, no skeleton): a blank region while the
// server thinks; when its layout shifts by more than ADR 0087's 0.02 once it has painted (a reveal
// that pushes things); when a skeleton is still up after every answer came (a spinner with no end);
// when a wait on another player shows no waiting indicator; or, failing, when it shows neither what
// it knew nor a failure card with Try again. The screens are the page's own, reached by their URLs
// (FRAME_SCREENS and the online flows' states), with the API answered by the test.
import { expect, vi } from 'vitest';
import { rememberLive } from '../app/live-memory.ts';
import { ACCOUNT_STORAGE_KEY, rememberGuest } from '../app/online-device.ts';
import { visitCache } from '../app/visit-cache.ts';
import { FRAME_SCREENS } from './frame-anchors-flow.ts';
import { ONLINE_STATES, type OnlineAnswers } from './online-looks-support.ts';
import { frames, until, visible } from './page-support.ts';
import { RECORD_ANSWERS } from './profile-answers.ts';
import { follow, onScreen, openAs, screenOn } from './shell-routes-support.ts';

/** Each API call takes this long: a slow phone network to the server (the owner's 1.5 s). */
export const SLOW_MS = 1_500;
/** Looked at this long after a screen shows: past ADR 0087's 150 ms, long before any answer. */
const SHOWN_BY = 300;
/** ADR 0087: a visit's layout shifts stay at or under this. */
const MOST_SHIFT = 0.02;

const FRIENDS = [
  { id: 'f-1', name: 'Jo', status: 'offline' },
  { id: 'f-2', name: 'Robin', status: 'online' },
];
const SIGNED_IN: OnlineAnswers = {
  '/api/v1/me': { name: 'robin_b', account: true, username: 'robin_b' },
  '/api/v1/me/inbox': { friends: FRIENDS, requests: 1, invites: [], turns: [] },
  '/api/v1/me/match': { match: null },
  '/api/v1/friends': {
    code: '7KQ2M9XD',
    friends: FRIENDS,
    incoming: [{ id: 'r-1', name: 'Morgan' }],
    outgoing: [],
    blocked: [],
  },
  ...RECORD_ANSWERS,
};

/** States where the player waits on the other: each must show its waiting indicator. */
const WAITS_ON_THEM: ReadonlySet<string> = new Set([
  'the friend lobby',
  'the link lobby',
  'the end, your rematch asked',
]);
const WAITING_MARKS = '.notice-waiting-ball, .notice-waiting-disc, .pick-clock-dots, .busy-ball';

/** The API as the test answers it, every call taking `slow` ms, or failing with a 500. */
function slowApi(how: { slow: number; failing: boolean }) {
  const answered = window.fetch.bind(window);
  let pending = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    if (!url.pathname.startsWith('/api/')) return answered(input, init);
    pending += 1;
    try {
      await new Promise((resolve) => setTimeout(resolve, how.slow));
      if (how.failing) {
        return new Response(
          JSON.stringify({ error: { code: 'internal', message: 'Slow and failing' } }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return await answered(input, init);
    } finally {
      pending -= 1;
    }
  });
  return { pending: () => pending };
}

/** One layout shift as the browser reports it (Chromium): how much, and what moved. */
interface Shift extends PerformanceEntry {
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly sources?: readonly { readonly node?: Node | null }[];
}

/** What moved, by its id or first class, for the report. */
const nameOf = (node: Node | null | undefined): string => {
  if (!(node instanceof Element)) return node?.nodeName ?? '?';
  return node.id !== '' ? `#${node.id}` : `.${node.classList[0] ?? node.tagName.toLowerCase()}`;
};

/** Layout shifts from now (Chromium has the API; elsewhere none are counted). */
function watchShifts(): { stop(): { total: number; moved: string } } {
  let total = 0;
  const moved = new Set<string>();
  if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
    return { stop: () => ({ total: 0, moved: '' }) };
  }
  const take = (entries: PerformanceEntry[]) => {
    for (const entry of entries as Shift[]) {
      if (entry.hadRecentInput) continue;
      total += entry.value;
      for (const source of entry.sources ?? []) moved.add(nameOf(source.node));
    }
  };
  const observer = new PerformanceObserver((list) => {
    take(list.getEntries());
  });
  observer.observe({ type: 'layout-shift' });
  return {
    stop() {
      take(observer.takeRecords());
      observer.disconnect();
      return { total: Math.round(total * 1000) / 1000, moved: [...moved].slice(0, 4).join(' ') };
    },
  };
}

/** What the screen shows outside its header row and the tabs: words, pictures or a skeleton. */
const shownParts = () =>
  visible(
    '#stage :is(p, h1, h2, h3, li, button, a, canvas, svg, input, .skeleton-block, .friends-skeleton)',
  ).filter((node) => node.closest('.screen-header, .tab-bar, .tab-rail') === null);
const skeletonUp = () =>
  visible('.skeleton-block, .friends-skeleton, .friends-skeleton-row').filter(
    (node) => node.closest('[hidden]') === null,
  ).length > 0 ||
  // Play waiting for `/me/match` (home-play-state.ts) is a skeleton too.
  document.querySelector('#home:not([hidden]) .home-play-row[data-waiting]:not([hidden])') !== null;
const failureShown = () =>
  visible('#stage button').some((node) => node.textContent.trim() === 'Try again');

/** One screen, looked at as it loads. */
async function look(
  name: string,
  go: () => Promise<void>,
  api: { pending(): number },
  failing: boolean,
  problems: string[],
  /** Shown in full: every answer in, or (a live fight, which reads on) the state's own mark. */
  ready: () => boolean = () => api.pending() === 0,
): Promise<void> {
  await go();
  await frames(2);
  const shifts = watchShifts();
  await new Promise((resolve) => setTimeout(resolve, SHOWN_BY));
  if (shownParts().length === 0) problems.push(`${name}: nothing shown ${String(SHOWN_BY)} ms in`);
  await until(ready, SLOW_MS * 6, `${name}: shown in full`, false);
  await frames(3);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const shift = shifts.stop();
  // A fight's own motion (the arena, its tips, the round turning into the result) is the arena's
  // (ADR 0007, 0039), not loading: shifts are counted where nothing fights.
  const fight = document.body.dataset['shell'] === 'fight';
  if (!fight && shift.total > MOST_SHIFT) {
    problems.push(
      `${name}: layout shift ${String(shift.total)} after first paint (${shift.moved})`,
    );
  }
  // A skeleton is fine while its read is out (All matches' next page); never after.
  if (skeletonUp() && api.pending() === 0) {
    problems.push(`${name}: a skeleton still up after every answer`);
  }
  if (WAITS_ON_THEM.has(name) && !failing && visible(WAITING_MARKS).length === 0) {
    problems.push(`${name}: waits on the other player with no waiting indicator`);
  }
  if (shownParts().length === 0) problems.push(`${name}: empty once answered`);
  // A screen that reads, cold and failing, says so with Try again (ADR 0087 rule 7).
  if (failing && name.endsWith('(cold)') && READS.some((one) => name.startsWith(one))) {
    if (!failureShown()) problems.push(`${name}: failed with no Try again`);
  }
}

/** The screens whose content is a read: cold and failing, each shows the failure card. */
const READS = ['Friends', 'Profile', 'All matches'];

/** Play's place, as a player could press it: on screen, not waiting, not inert. */
const playOffered = (): boolean => {
  const row = document.querySelector<HTMLElement>('#home:not([hidden]) .home-play-row');
  return (
    row !== null &&
    !row.hidden &&
    !row.inert &&
    row.getClientRects().length > 0 &&
    getComputedStyle(row).visibility !== 'hidden'
  );
};
const backToLineupShown = () =>
  visible('#home button').some((node) => node.textContent.includes('Back to your lineup'));

/**
 * Home while the player is choosing lineups (ADR 0089 addendum of 2026-11-27, the setup phase):
 * cold (nothing known this visit), Play waits for the slow `/me/match` and is never pressable, then
 * "Back to your lineup"; warm (the page showed the lineup), the way back at once. Failing, Play
 * shows once the answer fails (vs Bot works offline; the server refuses a second match itself).
 */
async function homeInAStart(
  api: OnlineAnswers,
  slow: { pending(): number },
  failing: boolean,
  problems: string[],
): Promise<void> {
  const start = {
    kind: 'start',
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    format: 'reveal',
    bestOf: 3,
  } as const;
  api['/api/v1/me/match'] = { match: start };
  rememberGuest(() => localStorage, true);
  for (const visit of ['cold', 'warm'] as const) {
    const name = `Home during a start (${visit})`;
    await follow('?view=manual');
    if (visit === 'cold') visitCache.clear();
    else rememberLive(start);
    const seen = { offered: false, sampling: true };
    const sample = () => {
      if (!seen.sampling) return;
      if (playOffered()) seen.offered = true;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    await look(
      name,
      async () => {
        await follow('');
        if (visit === 'warm' && !backToLineupShown()) problems.push(`${name}: no way back at once`);
      },
      slow,
      failing,
      problems,
    );
    seen.sampling = false;
    if (failing) continue;
    if (seen.offered) problems.push(`${name}: Play offered before the server said`);
    if (!backToLineupShown()) problems.push(`${name}: no "Back to your lineup" once answered`);
  }
  api['/api/v1/me/match'] = { match: null };
  visitCache.clear();
}

/**
 * Walks every screen and online state signed in, the API slowed (and `failing`), cold then warm.
 * Fails with every problem found, by screen.
 */
export async function walkSlowly(failing: boolean): Promise<void> {
  vi.stubEnv('VITE_TURNS', '1');
  localStorage.setItem(ACCOUNT_STORAGE_KEY, '1');
  const api: OnlineAnswers = { ...SIGNED_IN };
  await openAs({ online: true, accounts: true }, '', api);
  await onScreen('home');
  // The visit so far read at full speed; from here every call is slow, and nothing is known.
  const slow = slowApi({ slow: SLOW_MS, failing });
  visitCache.clear();
  const problems: string[] = [];
  const screens = FRAME_SCREENS.filter(([, , screen]) => screen !== 'signin');
  for (const visit of ['cold', 'warm'] as const) {
    for (const [name, search, screen] of screens) {
      await look(
        `${name} (${visit})`,
        async () => {
          await follow(search === '' ? '?view=manual' : search);
          if (search === '') await follow('');
          await until(() => screenOn() === screen, 5_000, name, false);
        },
        slow,
        failing,
        problems,
      );
    }
  }
  await homeInAStart(api, slow, failing, problems);
  if (!failing) {
    for (const state of ONLINE_STATES) {
      Object.assign(api, await state.answers(Date.now()));
      await look(
        state.name,
        async () => {
          await follow(state.search);
        },
        slow,
        failing,
        problems,
        state.ready,
      );
    }
  }
  expect(problems).toStrictEqual([]);
}
