// An account's record on Profile (ADR 0088, 0089 A1) through a fake `/me/record`: the record card,
// a button opening Your stats; Last matches once loaded (three on a phone, up to eight on a
// desktop), Won and Lost as words on their tags, a forfeit said by whose it was, each row opening
// its series; All matches only when there are more; the empty state before the first online match
// (no Last matches); the one failure card with Try again; placeholders only for a slow read; and
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
  let all = 0;
  const record = createProfileRecord({
    allMatches: () => {
      all += 1;
    },
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
  return { record, answers, opened, all: () => all };
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

/** The desktop's layout (profile-record.css): eight matches in the main column, else three. */
const DESKTOP = '(min-width: 64rem) and (min-aspect-ratio: 5/4)';
const rowsShown = () => (matchMedia(DESKTOP).matches ? 8 : 3);

describe('an account’s record on Profile (ADR 0088, 0089)', () => {
  it('shows the card’s three facts and the rows, each opening its series', async () => {
    const { record, answers, opened, all } = mount();
    const read = record.refresh();
    // Static first: the card's title and the section's heading at once.
    expect(texts('.profile-stats .friends-card-title')).toStrictEqual(['Your record']);
    expect(texts('.profile-recent .friends-group-title')).toStrictEqual(['Last matches']);
    answers[0]?.(ok(RECORD));
    await read;
    expect(texts('.profile-fact-label')).toStrictEqual(['Wins', 'Played', 'Favourite']);
    expect(texts('.profile-fact-value')).toStrictEqual(['3', '5', 'Vampire']);
    expect(shown('.profile-fact-icon')).toHaveLength(1);
    expect(texts('.profile-match .friends-name')).toStrictEqual(['Jo', 'Deleted player']);
    // Won filled, Lost outlined: the word on the tag, then the score.
    expect(texts('.profile-match-result')).toStrictEqual(['Won', 'Lost']);
    const [won, lost] = shown('.profile-match-result');
    if (won === undefined || lost === undefined) throw new Error('No tags');
    expect(getComputedStyle(won).backgroundColor).not.toBe(getComputedStyle(lost).backgroundColor);
    expect(texts('.profile-match-detail')).toStrictEqual(['2–1', '2–1']);
    expect(texts('.profile-match-when span')).toStrictEqual(['Today', 'Live', 'Today', 'By turns']);
    const buttons = shown('.profile-match button');
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Won against Jo, 2 to 1, Today, live');
    buttons[1]?.click();
    expect(opened).toStrictEqual(['s-2']);
    // Five played, two listed: All matches only on a phone, where three would show.
    expect(shown('.profile-all').length).toBe(rowsShown() === 3 ? 1 : 0);
    shown('.profile-all')[0]?.click();
    expect(all()).toBe(rowsShown() === 3 ? 1 : 0);
  });

  it('says whose forfeit it was, and lists three on a phone or eight on a desktop', async () => {
    const { record, answers, all } = mount();
    const read = record.refresh();
    const endings = ['youLeft', 'theyLeft', 'yourTime', 'theirTime'] as const;
    const recent = Array.from({ length: 20 }, (_, at) =>
      row(`s-${String(at)}`, { forfeit: at < 4, ending: endings[at] ?? null, won: at % 2 === 1 }),
    );
    answers[0]?.(ok(recordFixture({ played: 25, recent, next: 'more' })));
    await read;
    const words = ['You left', 'They left', 'Your time ran out', 'Their time ran out'];
    expect(texts('.profile-match-detail')).toStrictEqual(
      [...words, '2–1', '2–1', '2–1', '2–1'].slice(0, rowsShown()),
    );
    expect(shown('.profile-all')).toHaveLength(1);
    shown('.profile-all')[0]?.click();
    expect(all()).toBe(1);
  });

  it('opens Your stats from the card, the shared sheet with one ×', async () => {
    const { record, answers } = mount();
    const read = record.refresh();
    answers[0]?.(ok(RECORD));
    await read;
    const card = shown('button.profile-stats')[0];
    expect(card?.getAttribute('aria-label')).toBe('Your record: 3 wins of 5 played. More stats');
    expect(texts('.profile-stats-more')).toStrictEqual(['More stats']);
    card?.click();
    const sheet = document.querySelector<HTMLDialogElement>('dialog.stats-sheet');
    expect(sheet?.open).toBe(true);
    expect(sheet?.querySelector('.sheet-title')?.textContent).toBe('Your stats');
    expect(texts('.stats-label')).toStrictEqual([
      'Win rate',
      'Live',
      'By turns',
      'Best of 3',
      'Best of 5',
      'Best streak',
      'Most played',
    ]);
    expect(texts('.stats-value')).toStrictEqual([
      '60%',
      '2 won · 1 lost',
      '1 won · 1 lost',
      '3 won · 1 lost',
      '0 won · 1 lost',
      '2 wins',
      'Vampire · 4',
    ]);
    expect(sheet?.querySelectorAll('.close-button')).toHaveLength(1);
    record.close();
    expect(sheet?.open).toBe(false);
  });

  it('says what will show before the first online match, with no Last matches', async () => {
    const { record, answers } = mount();
    const read = record.refresh();
    answers[0]?.(ok(recordFixture({ wins: 0, played: 0, favourite: null })));
    await read;
    expect(texts('.profile-empty')).toHaveLength(1);
    expect(texts('.profile-fact-value')).toStrictEqual([]);
    expect(shown('.profile-recent')).toHaveLength(0);
    // Nothing to open yet: the card is no button.
    expect(shown('button.profile-stats')).toHaveLength(0);
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
