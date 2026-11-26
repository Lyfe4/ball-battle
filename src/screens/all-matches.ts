// All matches (ADR 0089): every finished online match of an account, its own screen opened from
// Profile (`?view=matches`), with Back. The first page is the record Profile read this visit (no
// second read); a cold link or a reload reads `/me/record` for it. Each later page is read only as
// the player scrolls to the list's end (`/me/matches?after=`, ADR 0084 addendum): a sized loading
// row while it comes (shown after SKELETON_AFTER_MS), a quiet line at the end, and the one failure
// card with Try again in the loading row's place, the rows already shown kept.
import type { MatchesPage, RecentSeries, RecordResponse } from '../api/record.ts';
import { failureKindOf, type ApiResult } from '../app/api.ts';
import { visitCache } from '../app/visit-cache.ts';
import { element } from '../ui/dom.ts';
import {
  DEFAULT_SKELETON_ROWS,
  failureCard,
  SKELETON_AFTER_MS,
  skeletonRows,
} from '../ui/online/friends-loading.ts';
import { createMatchRow } from '../ui/online/match-row.ts';
import { RECORD_SEEN } from '../ui/online/profile-record.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import { failureLine } from './online-failure-text.ts';
import {
  ALL_MATCHES,
  endLine,
  MATCHES_FAILED_TITLE,
  matchesLine,
  RECORD_EMPTY,
  RECORD_FAILED_TITLE,
} from './record-text.ts';

export interface AllMatchesHost {
  /** In-app Back: Profile, where it was opened from. */
  readonly back: () => void;
  /** GET /me/record: the first page, when this visit hasn't read it. */
  readonly record: () => Promise<ApiResult<RecordResponse | undefined>>;
  /** GET /me/matches?after=: the page after `cursor`. */
  readonly page: (cursor: string) => Promise<ApiResult<MatchesPage | undefined>>;
  /** Opens a finished series' own screen, once read. */
  readonly open: (id: string) => Promise<unknown>;
  /** Not an account (a guest's link): Profile says what signing in unlocks. */
  readonly notAnAccount: () => void;
}

export interface AllMatchesScreen {
  show(): void;
  setVisible(visible: boolean): void;
}

export function createAllMatches(root: HTMLElement, host: AllMatchesHost): AllMatchesScreen {
  root.setAttribute('aria-label', ALL_MATCHES);
  root.classList.add('matches-screen');
  const header = createScreenHeader(ALL_MATCHES, 'Back to Profile', host.back);
  const line = element('p', 'matches-line');
  const list = element('ul', 'friends-list matches-list');
  // Where the next page goes: the loading row while it comes, the failure card, or the end line.
  const tail = element('div', 'matches-tail');
  const body = element('div', 'matches-body');
  body.append(line, list, tail);
  root.replaceChildren(header.element, body);

  let visible = false;
  /** Bumped on every show: an answer for an earlier showing is dropped. */
  let showing = 0;
  let next: string | null = null;
  let loading = false;
  let played = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void more();
    },
    // A page ahead of the end, so the next rows are usually there before the player gets to them.
    { rootMargin: '0px 0px 600px 0px' },
  );

  /** The loading row: a match row's size, seen only for a slow read. */
  function loadingRow(): HTMLElement {
    const rows = skeletonRows(1);
    rows.classList.add('matches-loading');
    return rows;
  }

  function append(matches: readonly RecentSeries[]): void {
    const now = new Date();
    list.append(...matches.map((series) => createMatchRow(series, now, host.open)));
  }

  function settle(cursor: string | null): void {
    next = cursor;
    observer.disconnect();
    if (next === null) {
      tail.replaceChildren(element('p', 'matches-end', endLine(played)));
      return;
    }
    tail.replaceChildren(loadingRow());
    observer.observe(tail);
  }

  async function more(): Promise<void> {
    if (loading || next === null) return;
    loading = true;
    const at = showing;
    const answer = await host.page(next);
    loading = false;
    if (at !== showing) return;
    if (answer.ok && answer.body !== undefined) {
      append(answer.body.matches);
      settle(answer.body.next);
      return;
    }
    observer.disconnect();
    const kind = answer.ok ? 'error' : failureKindOf(answer);
    tail.replaceChildren(
      failureCard(MATCHES_FAILED_TITLE, failureLine(kind), async () => {
        tail.replaceChildren(loadingRow());
        await more();
      }),
    );
  }

  function first(record: RecordResponse): void {
    played = record.played;
    line.textContent = matchesLine(played);
    line.hidden = false;
    list.classList.remove('friends-skeleton');
    list.removeAttribute('aria-hidden');
    list.hidden = false;
    list.replaceChildren();
    if (played === 0) {
      observer.disconnect();
      line.hidden = true;
      tail.replaceChildren(element('p', 'friends-card-text matches-empty', RECORD_EMPTY));
      return;
    }
    append(record.recent);
    settle(record.next);
  }

  async function open(): Promise<void> {
    showing += 1;
    const at = showing;
    observer.disconnect();
    loading = false;
    const seen = visitCache.read(RECORD_SEEN);
    if (seen !== undefined) {
      first(seen);
      return;
    }
    // A cold link or a reload: the record's first page, placeholders only for a slow read.
    line.hidden = true;
    list.replaceChildren(...skeletonRows(DEFAULT_SKELETON_ROWS).children);
    list.classList.add('friends-skeleton');
    list.setAttribute('aria-hidden', 'true');
    list.hidden = true;
    window.setTimeout(() => {
      if (list.classList.contains('friends-skeleton')) list.hidden = false;
    }, SKELETON_AFTER_MS);
    tail.replaceChildren();
    const answer = await host.record();
    if (at !== showing) return;
    if (answer.ok && answer.body !== undefined) {
      visitCache.write(RECORD_SEEN, answer.body);
      first(answer.body);
      return;
    }
    if (!answer.ok && answer.kind === 'error' && answer.code === 'not_an_account') {
      host.notAnAccount();
      return;
    }
    list.hidden = true;
    const kind = answer.ok ? 'error' : failureKindOf(answer);
    tail.replaceChildren(failureCard(RECORD_FAILED_TITLE, failureLine(kind), open));
  }

  return {
    show() {
      void open();
      header.focus();
    },
    setVisible(shown) {
      visible = shown;
      root.hidden = !visible;
      if (!visible) observer.disconnect();
    },
  };
}
