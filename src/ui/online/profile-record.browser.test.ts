// An account's record on Profile (ADR 0088) through a fake `/me/record`: the stats card and Recent
// matches once loaded, each row opening its series; the empty state before the first online match
// (no Recent matches); the one failure card with Try again; placeholders only for a slow read; and
// what this visit read shown at once on return.
import { beforeEach, describe, expect, it } from 'vitest';
import '../../style.css';
import type { RecentSeries, RecordResponse } from '../../api/record.ts';
import type { ApiResult } from '../../app/api.ts';
import { visitCache } from '../../app/visit-cache.ts';
import { BALL_LOOKUP } from '../../sim/balls/index.ts';
import { recordFixture, seriesFixture } from '../../api/record-support.ts';
import { createProfileRecord } from './profile-record.ts';

const row = (id: string, over: Partial<RecentSeries> = {}): RecentSeries =>
  seriesFixture({ id, ...over });
const RECORD: RecordResponse = recordFixture({
  recent: [row('s-1'), row('s-2', { won: false, live: false, opponent: null })],
});
const ok = (body: RecordResponse): ApiResult<RecordResponse | undefined> => ({
  ok: true,
  status: 200,
  body,
  etag: null,
  clock: undefined,
});

/** The record over answers given in turn; each pending until the test settles it. */
function mount() {
  const answers: ((answer: ApiResult<RecordResponse | undefined>) => void)[] = [];
  const opened: string[] = [];
  const record = createProfileRecord({
    lookup: BALL_LOOKUP,
    load: () =>
      new Promise((resolve) => {
        answers.push(resolve);
      }),
    open: (id) => {
      opened.push(id);
      return Promise.resolve();
    },
  });
  document.body.replaceChildren(record.element);
  return { record, answers, opened };
}

const shown = (selector: string) =>
  [...document.querySelectorAll<HTMLElement>(selector)].filter(
    (node) => node.closest('[hidden]') === null && node.getClientRects().length > 0,
  );
const texts = (selector: string) => shown(selector).map((node) => node.textContent.trim());
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  visitCache.clear();
});

describe('an account’s record on Profile (ADR 0088)', () => {
  it('shows the card’s three facts and the rows, each opening its series', async () => {
    const { record, answers, opened } = mount();
    const read = record.refresh();
    // Static first: the card's title and the section's heading at once.
    expect(texts('.profile-stats .friends-card-title')).toStrictEqual(['Your record']);
    expect(texts('.profile-recent .friends-group-title')).toStrictEqual(['Recent matches']);
    answers[0]?.(ok(RECORD));
    await read;
    expect(texts('.profile-fact-label')).toStrictEqual(['Wins', 'Played', 'Favourite']);
    expect(texts('.profile-fact-value')).toStrictEqual(['3', '5', 'Vampire']);
    expect(shown('.profile-fact-icon')).toHaveLength(1);
    expect(texts('.profile-match .friends-name')).toStrictEqual(['Jo', 'Deleted player']);
    expect(texts('.profile-match-result')).toStrictEqual(['Won 2–1', 'Lost 2–1']);
    const buttons = shown('.profile-match button');
    expect(buttons[0]?.getAttribute('aria-label')).toMatch(/^Won against Jo, 2 to 1, live, /);
    buttons[1]?.click();
    expect(opened).toStrictEqual(['s-2']);
  });

  it('says what will show before the first online match, with no Recent matches', async () => {
    const { record, answers } = mount();
    const read = record.refresh();
    answers[0]?.(ok(recordFixture({ wins: 0, played: 0, favourite: null })));
    await read;
    expect(texts('.profile-empty')).toHaveLength(1);
    expect(texts('.profile-fact-value')).toStrictEqual([]);
    expect(shown('.profile-recent')).toHaveLength(0);
  });

  it('shows placeholders only for a slow read, then one failure card with Try again', async () => {
    const { record, answers } = mount();
    const read = record.refresh();
    expect(shown('.friends-skeleton-row')).toHaveLength(0);
    await tick(250);
    expect(shown('.friends-skeleton-row').length).toBeGreaterThan(0);
    answers[0]?.({ ok: false, kind: 'offline' });
    await read;
    expect(texts('.friends-failure .friends-card-title')).toStrictEqual(['Your record']);
    expect(shown('.profile-stats')).toHaveLength(0);
    expect(shown('.profile-recent')).toHaveLength(0);
    const again = shown('.friends-failure button')[0];
    expect(again?.textContent).toBe('Try again');
    again?.click();
    await tick(20);
    answers[1]?.(ok(RECORD));
    await tick(20);
    expect(texts('.profile-fact-value')).toStrictEqual(['3', '5', 'Vampire']);
  });

  it('shows what this visit read at once on return, and keeps it if the new read fails', async () => {
    const first = mount();
    const read = first.record.refresh();
    first.answers[0]?.(ok(RECORD));
    await read;
    const again = mount();
    void again.record.refresh();
    expect(texts('.profile-fact-value')).toStrictEqual(['3', '5', 'Vampire']);
    again.answers[0]?.({ ok: false, kind: 'timeout' });
    await tick(20);
    expect(texts('.profile-fact-value')).toStrictEqual(['3', '5', 'Vampire']);
    expect(shown('.friends-failure')).toHaveLength(0);
  });
});
