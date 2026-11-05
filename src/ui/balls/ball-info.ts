import type { BallDefinition } from '../../sim/types.ts';
import { element, setText } from '../dom.ts';
import { matchupsOf, type MatchupLine } from './matchups.ts';

export interface BallInfo {
  readonly element: HTMLElement;
  /** Shows `id`: its name, its one line, and who it beats and loses to. */
  show(id: string): void;
}

/**
 * A short card about one ball, under the picker's slots: its full one-line description (never
 * clipped) and its counters by name, from the counter map. The manual's detail adds stats and the
 * reasons.
 */
export function createBallInfo(balls: readonly BallDefinition[]): BallInfo {
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
    },
  };
}
