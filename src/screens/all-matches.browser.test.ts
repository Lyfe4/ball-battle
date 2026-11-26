// All matches (ADR 0089) through a fake API: the first page is the record this visit read (no
// request), or one read of `/me/record` on a cold link; scrolling to the end reads the next page
// (`/me/matches?after=`), a sized loading row while it comes, a quiet line at the end; a failed page
// keeps the rows and shows the one failure card with Try again in the loading row's place; a guest's
// link goes to Profile; Back is always in the header, so no state is a dead end.
import { beforeEach, describe, expect, it } from 'vitest';
import '../style.css';
import type { MatchesPage, RecentSeries, RecordResponse } from '../api/record.ts';
import { recordFixture, seriesFixture } from '../api/record-support.ts';
import type { ApiResult } from '../app/api.ts';
import { visitCache } from '../app/visit-cache.ts';
import { RECORD_SEEN } from '../ui/online/profile-record.ts';
import { createAllMatches } from './all-matches.ts';

const ok = <T>(body: T): ApiResult<T | undefined> => ({
  ok: true,
  status: 200,
  body,
  etag: null,
  clock: undefined,
});

const page = (from: number, count: number): RecentSeries[] =>
  Array.from({ length: count }, (_, at) => seriesFixture({ id: `s-${String(from + at)}` }));

const RECORD: RecordResponse = recordFixture({ played: 45, recent: page(0, 20), next: 'c-20' });

type Pending<T> = (answer: ApiResult<T | undefined>) => void;

function mount() {
  const root = document.createElement('section');
  document.body.replaceChildren(root);
  const records: Pending<RecordResponse>[] = [];
  const pages: { cursor: string; answer: Pending<MatchesPage> }[] = [];
  const done: string[] = [];
  const screen = createAllMatches(root, {
    back: () => done.push('back'),
    record: () =>
      new Promise((resolve) => {
        records.push(resolve);
      }),
    page: (cursor) =>
      new Promise((resolve) => {
        pages.push({ cursor, answer: resolve });
      }),
    open: (id) => {
      done.push(`open ${id}`);
      return Promise.resolve();
    },
    notAnAccount: () => done.push('profile'),
  });
  screen.setVisible(true);
  screen.show();
  return { records, pages, done };
}

const shown = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (node) => node.closest('[hidden]') === null && node.getClientRects().length > 0,
  );
const texts = (selector: string) => shown(selector).map((node) => node.textContent.trim());
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits until `check`, as long as a slow engine needs, failing with `what`. */
const until = async (check: () => boolean, what: string) => {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await tick(20);
  }
};
/** Scrolls the list's end into view, as a player reaching it does. */
const toEnd = () => {
  document.querySelector('.matches-tail')?.scrollIntoView({ block: 'end' });
};
/** Back, in the header: the way out of every state. */
const backShown = () => shown('.screen-back').length === 1;

beforeEach(() => {
  visitCache.clear();
});

describe('All matches (ADR 0089)', () => {
  it('starts from the record this visit read, then reads a page at a time to the end', async () => {
    visitCache.write(RECORD_SEEN, RECORD);
    const { records, pages, done } = mount();
    expect(records).toHaveLength(0);
    expect(texts('h1')).toStrictEqual(['All matches']);
    expect(texts('.matches-line')).toStrictEqual(['45 matches · online with friends']);
    expect(shown('.matches-list .profile-match')).toHaveLength(20);
    toEnd();
    await until(() => pages.length === 1, 'the second page');
    expect(pages[0]?.cursor).toBe('c-20');
    // A slow page: the loading row, a row's size, only after 150 ms.
    expect(shown('.matches-loading .friends-skeleton-row')).toHaveLength(0);
    await tick(250);
    expect(shown('.matches-loading .friends-skeleton-row')).toHaveLength(1);
    pages[0]?.answer(ok({ matches: page(20, 20), next: 'c-40' }));
    await until(() => shown('.matches-list .profile-match').length === 40, '40 rows');
    toEnd();
    await until(() => pages.length === 2, 'the third page');
    pages[1]?.answer(ok({ matches: page(40, 5), next: null }));
    await until(() => texts('.matches-end').length === 1, 'the end');
    expect(texts('.matches-end')).toStrictEqual(['That’s all 45.']);
    expect(shown('.matches-loading')).toHaveLength(0);
    const ids = shown('.matches-list .profile-match').map((row) => row.dataset['series']);
    expect(new Set(ids).size).toBe(45);
    toEnd();
    await tick(100);
    expect(pages).toHaveLength(2);
    expect(backShown()).toBe(true);
    shown('.matches-list .profile-match button')[44]?.click();
    shown('.screen-back')[0]?.click();
    expect(done).toStrictEqual(['open s-44', 'back']);
  });

  it('keeps the rows when a page fails, with the one failure card and Try again', async () => {
    visitCache.write(RECORD_SEEN, RECORD);
    const { pages } = mount();
    toEnd();
    await until(() => pages.length === 1, 'the second page');
    pages[0]?.answer({ ok: false, kind: 'offline' });
    await until(() => shown('.friends-failure').length === 1, 'the failure card');
    expect(texts('.friends-failure .friends-card-title')).toStrictEqual(['More matches']);
    expect(shown('.matches-list .profile-match')).toHaveLength(20);
    expect(backShown()).toBe(true);
    shown('.friends-failure button')[0]?.click();
    await until(() => pages.length === 2, 'the page again');
    expect(pages[1]?.cursor).toBe('c-20');
    pages[1]?.answer(ok({ matches: page(20, 3), next: null }));
    await until(() => texts('.matches-end').length === 1, 'the end');
    expect(shown('.friends-failure')).toHaveLength(0);
    expect(shown('.matches-list .profile-match')).toHaveLength(23);
  });

  it('reads the record on a cold link, and fails into the one card with Try again', async () => {
    const { records } = mount();
    expect(records).toHaveLength(1);
    records[0]?.({ ok: false, kind: 'timeout' });
    await until(() => shown('.friends-failure').length === 1, 'the failure card');
    expect(backShown()).toBe(true);
    shown('.friends-failure button')[0]?.click();
    await until(() => records.length === 2, 'the record again');
    records[1]?.(ok(recordFixture({ played: 2, recent: page(0, 2) })));
    await until(() => texts('.matches-end').length === 1, 'the end');
    expect(texts('.matches-end')).toStrictEqual(['That’s all 2.']);
    expect(visitCache.read(RECORD_SEEN)?.played).toBe(2);
  });

  it('says what will count before the first match, and sends a guest to Profile', async () => {
    const empty = mount();
    empty.records[0]?.(ok(recordFixture({ wins: 0, played: 0, favourite: null })));
    await until(() => shown('.matches-empty').length === 1, 'the empty state');
    expect(shown('.matches-line')).toHaveLength(0);
    expect(backShown()).toBe(true);
    visitCache.clear();
    const guest = mount();
    guest.records[0]?.({
      ok: false,
      kind: 'error',
      status: 403,
      code: 'not_an_account',
      message: 'Sign in to see your record',
    });
    await until(() => guest.done.length === 1, 'Profile');
    expect(guest.done).toStrictEqual(['profile']);
  });
});
