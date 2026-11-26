// An account's record on Profile (ADR 0088): the stats card (wins, played, the favourite ball),
// then Recent matches, each row opening that finished series' own screen (Watch again there). One
// read, `/me/record`, when Profile opens; what this visit already read shows at once and refreshes
// in place (ADR 0087). Static first: the card's title and the section's heading are drawn at once,
// their numbers and rows as sized placeholders only once the read has taken SKELETON_AFTER_MS. An
// empty record is the card's empty state (Recent matches isn't drawn); a failure is the one failure
// card with Try again in the card's place.
import type { RecordResponse } from '../../api/record.ts';
import { failureKindOf, type ApiResult } from '../../app/api.ts';
import { visitCache, type VisitKey } from '../../app/visit-cache.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import { failureLine } from '../../screens/online-failure-text.ts';
import {
  RECENT_TITLE,
  RECORD_EMPTY,
  RECORD_FAILED_TITLE,
  RECORD_TITLE,
  recentRow,
  statFacts,
} from '../../screens/record-text.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';
import {
  DEFAULT_SKELETON_ROWS,
  failureCard,
  SKELETON_AFTER_MS,
  skeletonRows,
} from './friends-loading.ts';

/** The last record this visit read: shown at once on return (visit-cache.ts). */
const RECORD_SEEN: VisitKey<RecordResponse> = { name: 'record' };
const ICON_PX = 28;

export interface ProfileRecordHost {
  readonly lookup: DefinitionLookup;
  /** GET /me/record. */
  readonly load: () => Promise<ApiResult<RecordResponse | undefined>>;
  /** Opens a finished series' screen: a request (the button stays busy until it is read). */
  readonly open: (id: string) => Promise<unknown>;
}

export interface ProfileRecord {
  /** The stats card (or the failure card in its place), then Recent matches when there are any. */
  readonly element: HTMLElement;
  /** Reads the record (after showing what this visit already knows). */
  refresh(): Promise<void>;
}

export function createProfileRecord(host: ProfileRecordHost): ProfileRecord {
  const stats = element('section', 'friends-card profile-stats');
  stats.setAttribute('aria-labelledby', 'profile-stats-title');
  const statsTitle = element('h2', 'friends-card-title', RECORD_TITLE);
  statsTitle.id = 'profile-stats-title';
  const facts = element('dl', 'profile-facts');
  stats.append(statsTitle, facts);
  const recent = element('section', 'friends-group profile-recent');
  const list = element('ul', 'friends-list');
  recent.append(element('h2', 'friends-group-title', RECENT_TITLE), list);
  const holder = element('div', 'profile-record');
  holder.append(stats, recent);

  /** Placeholders where the numbers and rows will be, shown only for a slow read. */
  function placeholders(rows: number): void {
    holder.replaceChildren(stats, recent);
    const blocks = [0, 1, 2].map(() => {
      const fact = element('div', 'profile-fact');
      fact.append(element('span', 'skeleton-block skeleton-line-short'));
      return fact;
    });
    facts.replaceChildren(...blocks);
    facts.setAttribute('aria-busy', 'true');
    facts.dataset['loading'] = '';
    window.setTimeout(() => {
      if (facts.dataset['loading'] !== undefined) facts.dataset['shown'] = '';
    }, SKELETON_AFTER_MS);
    list.replaceChildren(...skeletonRows(rows).children);
    list.classList.add('friends-skeleton');
    list.setAttribute('aria-hidden', 'true');
    list.hidden = true;
    window.setTimeout(() => {
      if (list.classList.contains('friends-skeleton')) list.hidden = false;
    }, SKELETON_AFTER_MS);
    recent.hidden = false;
  }

  function show(record: RecordResponse): void {
    holder.replaceChildren(stats, recent);
    delete facts.dataset['loading'];
    delete facts.dataset['shown'];
    facts.removeAttribute('aria-busy');
    list.classList.remove('friends-skeleton');
    list.removeAttribute('aria-hidden');
    list.hidden = false;
    if (record.played === 0) {
      facts.replaceChildren(element('p', 'friends-card-text profile-empty', RECORD_EMPTY));
      recent.hidden = true;
      list.replaceChildren();
      return;
    }
    const known = (id: string) => host.lookup.get(id);
    facts.replaceChildren(
      ...statFacts(record, (id) => known(id)?.name).map((fact) => {
        const item = element('div', 'profile-fact');
        const value = element('dd', 'profile-fact-value');
        const ball = fact.ball === undefined ? undefined : known(fact.ball);
        if (ball !== undefined) {
          const icon = element('canvas', 'profile-fact-icon');
          icon.setAttribute('aria-hidden', 'true');
          drawBallIcon(icon, ball, ICON_PX);
          value.append(icon);
        }
        value.append(element('span', '', fact.value));
        item.append(element('dt', 'profile-fact-label', fact.label), value);
        return item;
      }),
    );
    const now = new Date();
    list.replaceChildren(
      ...record.recent.map((series) => {
        const row = recentRow(series, now);
        const item = element('li', 'friends-row profile-match');
        item.dataset['series'] = series.id;
        const open = element('button', 'friends-who friends-open');
        open.type = 'button';
        open.setAttribute('aria-label', row.label);
        const words = element('span', 'friends-words');
        const result = element('span', 'profile-match-result', row.result);
        result.dataset['won'] = String(row.won);
        words.append(element('span', 'friends-name', row.name), result);
        open.append(words, element('span', 'friends-status profile-match-when', row.when));
        busyOnClick(open, () => host.open(series.id));
        item.append(open);
        return item;
      }),
    );
    recent.hidden = record.recent.length === 0;
  }

  async function refresh(): Promise<void> {
    const generation = visitCache.generation();
    const seen = visitCache.read(RECORD_SEEN);
    if (seen === undefined) placeholders(DEFAULT_SKELETON_ROWS);
    else show(seen);
    const answer = await host.load();
    // Who the player is changed while it was asked (Log out, a switch): drop it.
    if (generation !== visitCache.generation()) return;
    if (answer.ok && answer.body !== undefined) {
      visitCache.write(RECORD_SEEN, answer.body);
      show(answer.body);
      return;
    }
    // Shown from this visit already: keep it rather than replace it with a failure.
    if (seen !== undefined) return;
    const kind = answer.ok ? 'error' : failureKindOf(answer);
    holder.replaceChildren(failureCard(RECORD_FAILED_TITLE, failureLine(kind), refresh));
  }

  return { element: holder, refresh };
}
