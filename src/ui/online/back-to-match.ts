// Home's way back (ADR 0053): while the player has a live match in progress, a lobby still waiting
// for their friend, or a rematch waiting on them (2026-11-23), it takes Play's place as the one
// clear action, in Play's own look (the same button, one look per screen state). It goes when what
// it leads back to is over.
import type { CurrentMatch } from '../../api/live.ts';
import { busyOnClick } from '../busy-button.ts';
import { element, setText } from '../dom.ts';
import { backWords, type BackWords } from './back-to-match-text.ts';

export interface HomeBack<T> {
  readonly element: HTMLElement;
  /** Shows the way back to `item`, or nothing; true when it shows. */
  show(item: T | null): boolean;
}

/**
 * `open` goes back to what it shows (a promise: the button shows it is working until the screen is
 * read), `wordsOf` says what that is.
 */
export function createHomeBack<T>(
  open: (item: T) => Promise<void> | void,
  wordsOf: (item: T) => BackWords,
): HomeBack<T> {
  const root = element('div', 'home-back-match');
  const button = element('button', 'hud-button hud-button-primary home-play');
  button.type = 'button';
  const label = element('span', 'home-play-label');
  const meta = element('span', 'home-play-meta');
  button.append(label, meta);
  root.append(button);
  root.hidden = true;
  let shown: T | null = null;
  busyOnClick(button, () => (shown === null ? undefined : open(shown)));
  return {
    element: root,
    show(item) {
      shown = item;
      root.hidden = item === null;
      if (item === null) return false;
      const words = wordsOf(item);
      setText(label, words.label);
      setText(meta, words.meta);
      button.setAttribute('aria-label', words.spoken);
      return true;
    },
  };
}

export type BackToMatch = HomeBack<CurrentMatch>;

/** "Back to your match" (or lobby): `open` goes to the match once its screen is read. */
export function createBackToMatch(open: (match: CurrentMatch) => Promise<void>): BackToMatch {
  return createHomeBack(open, backWords);
}
