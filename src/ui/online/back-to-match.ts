// Home's "Back to your match" (ADR 0053): while the player has a live match in progress, or a lobby
// still waiting for their friend, it takes Play's place as the one clear action, in Play's own look
// (the same button, one look per screen state). It goes when the match ends or the grace runs out.
import type { CurrentMatch } from '../../api/live.ts';
import { element, setText } from '../dom.ts';
import { backWords } from './back-to-match-text.ts';

export interface BackToMatch {
  readonly element: HTMLElement;
  /** Shows the match to go back to, or nothing; true when it shows. */
  show(match: CurrentMatch | null): boolean;
}

export function createBackToMatch(open: (match: CurrentMatch) => void): BackToMatch {
  const root = element('div', 'home-back-match');
  const button = element('button', 'hud-button hud-button-primary home-play');
  button.type = 'button';
  const label = element('span', 'home-play-label');
  const meta = element('span', 'home-play-meta');
  button.append(label, meta);
  root.append(button);
  root.hidden = true;
  let shown: CurrentMatch | null = null;
  button.addEventListener('click', () => {
    if (shown !== null) open(shown);
  });
  return {
    element: root,
    show(match) {
      shown = match;
      root.hidden = match === null;
      if (match === null) return false;
      const words = backWords(match);
      setText(label, words.label);
      setText(meta, words.meta);
      button.setAttribute('aria-label', words.spoken);
      return true;
    },
  };
}
