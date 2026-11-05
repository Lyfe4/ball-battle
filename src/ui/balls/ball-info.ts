import type { BallDefinition } from '../../sim/types.ts';
import { element, setText } from '../dom.ts';
import { matchupsOf, type MatchupLine } from './matchups.ts';

export interface BallInfo {
  readonly element: HTMLElement;
  /** Shows `id`: its name, its one line, and who it beats and loses to. */
  show(id: string): void;
}

export interface BallInfoLink {
  /** The URL of a ball's manual entry, so the link also opens in a new tab. */
  readonly href: (id: string) => string;
  /** A plain click: open the entry in the app, so Back returns here. */
  readonly open: (id: string) => void;
}

/**
 * A short card about one ball, under the picker's slots: its full one-line description (never
 * clipped) and its counters by name, from the counter map. With `link`, a small text link leads to
 * the ball's manual entry, which adds stats and the reasons.
 */
export function createBallInfo(balls: readonly BallDefinition[], link?: BallInfoLink): BallInfo {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const roster = balls.map((ball) => ball.id);
  const card = element('section', 'ball-info');
  card.setAttribute('aria-label', 'About this ball');
  const name = element('h3', 'ball-info-name');
  const description = element('p', 'ball-info-description');
  const counters = element('p', 'ball-info-counters');
  const beatsLabel = element('span', 'ball-info-beats', 'Beats');
  const beats = element('span', 'ball-info-list');
  const losesLabel = element('span', 'ball-info-loses', 'Loses to');
  const loses = element('span', 'ball-info-list');
  counters.append(beatsLabel, ' ', beats, ' · ', losesLabel, ' ', loses);
  card.append(name, description, counters);
  let shown = '';
  const more = element('a', 'text-link ball-info-more');
  if (link !== undefined) {
    more.addEventListener('click', (event) => {
      // A modified click (new tab, new window) follows the href as a link does.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      link.open(shown);
    });
    card.append(more);
  }

  const names = (lines: readonly MatchupLine[]) =>
    lines.length === 0
      ? 'nothing in particular'
      : lines.map((line) => byId.get(line.opponent)?.name ?? line.opponent).join(', ');

  return {
    element: card,
    show(id) {
      const ball = byId.get(id);
      if (ball === undefined) return;
      const { beats: favoured, losesTo } = matchupsOf(id, roster);
      setText(name, ball.name);
      setText(description, ball.description);
      setText(beats, names(favoured));
      setText(loses, names(losesTo));
      shown = id;
      if (link !== undefined) {
        setText(more, `More about ${ball.name}`);
        more.href = link.href(id);
      }
    },
  };
}
