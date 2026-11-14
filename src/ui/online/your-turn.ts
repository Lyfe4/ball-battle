// Home's "Your turn (n)" (ADR 0052): the player's open online series, theirs to play first, each one
// tap from its series. Shown only on a device that has played online, and only when a series is
// open; a finished series is in its own history, not here (show less, ADR 0025).
import type { SeriesSummary } from '../../api/series.ts';
import { timeLeft } from '../../app/online-series.ts';
import { element, setText } from '../dom.ts';
import { FORMAT_SHORT, bestOfName } from '../series-text.ts';

export interface YourTurn {
  readonly element: HTMLElement;
  show(series: readonly SeriesSummary[], now: number): void;
}

/** One row's words: "Player 4195 · Reveal · 1–0 · 23 h left". */
export function rowText(item: SeriesSummary, now: number): string {
  const other = item.you === 'a' ? 'b' : 'a';
  const left = timeLeft(item.deadline, now);
  return [
    item.opponent ?? 'Deleted player',
    `${bestOfName(item.bestOf)} ${FORMAT_SHORT[item.format]}`,
    `${String(item.score[item.you])}–${String(item.score[other])}`,
    ...(left === undefined ? [] : [left]),
  ].join(' · ');
}

export function createYourTurn(open: (id: string) => void): YourTurn {
  const root = element('section', 'home-online');
  const heading = element('h2', 'home-online-title');
  heading.id = 'home-online-title';
  root.setAttribute('aria-labelledby', heading.id);
  const list = element('ul', 'home-online-list');
  root.append(heading, list);
  root.hidden = true;
  return {
    element: root,
    show(series, now) {
      const open_ = series.filter((item) => item.status === 'open');
      root.hidden = open_.length === 0;
      const turns = open_.filter((item) => item.yourTurn).length;
      setText(heading, turns > 0 ? `Your turn (${String(turns)})` : 'Online series');
      list.replaceChildren(
        ...open_.map((item) => {
          const row = element('li', 'home-online-item');
          const button = element('button', 'home-online-row');
          button.type = 'button';
          button.dataset['yourTurn'] = String(item.yourTurn);
          const state = element(
            'span',
            'home-online-state',
            item.yourTurn ? 'Your turn' : 'Waiting',
          );
          button.append(state, element('span', 'home-online-line', rowText(item, now)));
          button.addEventListener('click', () => {
            open(item.id);
          });
          row.append(button);
          return row;
        }),
      );
    },
  };
}
