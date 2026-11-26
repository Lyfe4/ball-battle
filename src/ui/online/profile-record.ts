// An account's record on Profile (ADR 0088, 0089 A1): the record card (wins, played, the favourite
// ball), which opens "Your stats", then Last matches (three on a phone, more beside on a desktop,
// profile-record.css), each row opening that finished series' own screen, and "All matches ›". One
// read, `/me/record`, when Profile opens; what this visit already read shows at once and refreshes
// in place (ADR 0087). Static first: the card's title and the section's heading are drawn at once,
// their numbers and rows as sized placeholders only once the read has taken SKELETON_AFTER_MS. An
// empty record is the card's empty state (Last matches isn't drawn); a failure is the one failure
// card with Try again in the card's place.
import type { RecordResponse } from '../../api/record.ts';
import { failureKindOf, type ApiResult } from '../../app/api.ts';
import { visitCache, type VisitKey } from '../../app/visit-cache.ts';
import { drawBallIcon } from '../../render/ball-icon.ts';
import { failureLine } from '../../screens/online-failure-text.ts';
import {
  ALL_MATCHES,
  RECENT_ON_DESKTOP,
  RECENT_ON_PHONE,
  RECENT_TITLE,
  RECORD_EMPTY,
  RECORD_FAILED_TITLE,
  RECORD_MORE,
  RECORD_TITLE,
  recordLabel,
  statFacts,
} from '../../screens/record-text.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import {
  DEFAULT_SKELETON_ROWS,
  failureCard,
  SKELETON_AFTER_MS,
  skeletonRows,
} from './friends-loading.ts';
import { createMatchRow } from './match-row.ts';
import { createStatsSheet } from './stats-sheet.ts';

/** The last record this visit read: shown at once on return, and All matches' first page. */
export const RECORD_SEEN: VisitKey<RecordResponse> = { name: 'record' };
const ICON_PX = 28;

export interface ProfileRecordHost {
  readonly lookup: DefinitionLookup;
  /** GET /me/record. */
  readonly load: () => Promise<ApiResult<RecordResponse | undefined>>;
  /** Opens a finished series' screen: a request (the button stays busy until it is read). */
  readonly open: (id: string) => Promise<unknown>;
  /** All matches, its own screen. */
  readonly allMatches: () => void;
}

export interface ProfileRecord {
  /** The record card (or the failure card in its place), then Last matches when there are any. */
  readonly element: HTMLElement;
  /** Reads the record (after showing what this visit already knows). */
  refresh(): Promise<void>;
  /** Profile is leaving: Your stats closes with it. */
  close(): void;
}

export function createProfileRecord(host: ProfileRecordHost): ProfileRecord {
  const stats = createStatsSheet(host.lookup);
  let shown: RecordResponse | undefined;
  // The card: a section while empty or loading, a button that opens Your stats once there are any.
  const statsTitle = element('span', 'friends-card-title', RECORD_TITLE);
  statsTitle.id = 'profile-stats-title';
  const more = element('span', 'text-link profile-stats-more', RECORD_MORE);
  more.setAttribute('aria-hidden', 'true');
  const head = element('span', 'profile-stats-head');
  head.append(statsTitle, more);
  // Spans, not a list: inside a button, the card's label says it all (recordLabel).
  const facts = element('span', 'profile-facts');
  const card = element('button', 'friends-card profile-stats');
  card.type = 'button';
  card.addEventListener('click', () => {
    if (shown !== undefined && shown.played > 0) stats.open(shown);
  });
  card.append(head, facts);
  const empty = element('section', 'friends-card profile-stats');
  empty.setAttribute('aria-labelledby', 'profile-stats-title');

  const recent = element('section', 'friends-group profile-recent');
  const list = element('ul', 'friends-list');
  const all = element('button', 'text-link profile-all', ALL_MATCHES);
  all.type = 'button';
  // Named by its words alone: the chevron the link style adds is decoration.
  all.setAttribute('aria-label', ALL_MATCHES);
  all.addEventListener('click', host.allMatches);
  recent.append(element('h2', 'friends-group-title', RECENT_TITLE), list, all);
  const holder = element('div', 'profile-record');

  /** The card as a section (empty or loading): no button to press until there are stats. */
  function asSection(): void {
    empty.replaceChildren(head, facts);
    more.hidden = true;
    holder.replaceChildren(empty, recent);
  }

  /** Placeholders where the numbers and rows will be, shown only for a slow read. */
  function placeholders(rows: number): void {
    asSection();
    const blocks = [0, 1, 2].map(() => {
      const fact = element('span', 'profile-fact');
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
    all.hidden = true;
    recent.hidden = false;
  }

  function show(record: RecordResponse): void {
    shown = record;
    delete facts.dataset['loading'];
    delete facts.dataset['shown'];
    facts.removeAttribute('aria-busy');
    list.classList.remove('friends-skeleton');
    list.removeAttribute('aria-hidden');
    list.hidden = false;
    holder.toggleAttribute('data-empty', record.played === 0);
    if (record.played === 0) {
      asSection();
      empty.replaceChildren(head, element('p', 'friends-card-text profile-empty', RECORD_EMPTY));
      facts.replaceChildren();
      recent.hidden = true;
      list.replaceChildren();
      return;
    }
    card.replaceChildren(head, facts);
    more.hidden = false;
    card.setAttribute('aria-label', recordLabel(record));
    holder.replaceChildren(card, recent);
    const known = (id: string) => host.lookup.get(id);
    facts.replaceChildren(
      ...statFacts(record, (id) => known(id)?.name).map((fact) => {
        const item = element('span', 'profile-fact');
        const value = element('span', 'profile-fact-value');
        const ball = fact.ball === undefined ? undefined : known(fact.ball);
        if (ball !== undefined) {
          const icon = element('canvas', 'profile-fact-icon');
          icon.setAttribute('aria-hidden', 'true');
          drawBallIcon(icon, ball, ICON_PX);
          value.append(icon);
        }
        value.append(element('span', '', fact.value));
        item.append(element('span', 'profile-fact-label', fact.label), value);
        return item;
      }),
    );
    const now = new Date();
    const rows = record.recent.slice(0, RECENT_ON_DESKTOP);
    list.replaceChildren(...rows.map((series) => createMatchRow(series, now, host.open)));
    recent.hidden = rows.length === 0;
    // All matches when there are more than the rows shown: on a phone past three, on a desktop past
    // the eight its main column shows (profile-record.css).
    all.hidden = record.played <= RECENT_ON_PHONE;
    all.toggleAttribute('data-phone-only', record.played <= RECENT_ON_DESKTOP);
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

  return {
    element: holder,
    refresh,
    close: () => {
      stats.close();
    },
  };
}
