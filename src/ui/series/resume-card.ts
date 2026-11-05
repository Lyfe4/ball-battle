import { scoreOf, type SeriesState } from '../../sim/series.ts';
import { element, setText } from '../dom.ts';
import { SIDE_NAMES } from '../series-text.ts';

export interface ResumeCard {
  readonly element: HTMLElement;
  /** Shows the held series (its score), or hides the card when there is none. */
  show(held: SeriesState | undefined): void;
}

/**
 * A series the player left before it was decided (a Back, often by accident on a phone): one
 * button on the setup screens to carry on with it where it was (ADR 0025). Every choice already
 * made stays made; starting a new series replaces it.
 */
export function createResumeCard(onResume: () => void): ResumeCard {
  const button = element('button', 'hud-button hud-button-primary resume-card');
  button.type = 'button';
  const label = element('span', 'resume-card-label', 'Resume series');
  const score = element('span', 'resume-card-score');
  button.append(label, score);
  button.addEventListener('click', onResume);
  button.hidden = true;
  return {
    element: button,
    show(held) {
      button.hidden = held === undefined;
      if (held === undefined) return;
      const { a, b } = scoreOf(held);
      setText(score, `${String(a)} – ${String(b)}`);
      button.setAttribute(
        'aria-label',
        `Resume series, ${SIDE_NAMES.a} ${String(a)}, ${SIDE_NAMES.b} ${String(b)}`,
      );
    },
  };
}
