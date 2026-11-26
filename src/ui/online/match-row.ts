// One finished match (ADR 0088, 0089), on Profile and All matches alike: the opponent's disc and
// name, "Won" as a filled tag or "Lost" as an outlined one (a word, never colour alone) with the
// score or whose forfeit it was, then the date and Live or By turns. The whole row opens the
// series' own screen (Watch again there), busy until it is read.
import type { RecentSeries } from '../../api/record.ts';
import { matchRow } from '../../screens/record-text.ts';
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';

export function createMatchRow(
  series: RecentSeries,
  now: Date,
  open: (id: string) => Promise<unknown>,
): HTMLElement {
  const row = matchRow(series, now);
  const item = element('li', 'friends-row profile-match');
  item.dataset['series'] = series.id;
  const button = element('button', 'friends-who friends-open');
  button.type = 'button';
  button.setAttribute('aria-label', row.label);
  const disc = element('span', 'friends-disc friends-disc-row', row.name.slice(0, 1));
  disc.setAttribute('aria-hidden', 'true');
  if (series.opponent === null) disc.dataset['gone'] = '';
  const line = element('span', 'profile-match-line');
  const tag = element('span', 'profile-match-result', row.result);
  tag.dataset['won'] = String(row.won);
  line.append(tag, element('span', 'profile-match-detail', row.detail));
  const words = element('span', 'friends-words');
  words.append(element('span', 'friends-name', row.name), line);
  const when = element('span', 'friends-status profile-match-when');
  when.append(element('span', '', row.date), element('span', '', row.how));
  button.append(disc, words, when);
  busyOnClick(button, () => open(series.id));
  item.append(button);
  return item;
}
