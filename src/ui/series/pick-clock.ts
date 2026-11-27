import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element, setAttr, setHidden, setText } from '../dom.ts';
import type { PickClock } from '../../screens/pick-clock-text.ts';
import { waitingBall } from '../waiting.ts';

export interface PickClockCard {
  /** The card, placed by the series panel above its track, or by its owner (a rematch notice). */
  readonly element: HTMLElement;
  /** Shows `clock`, or hides both parts; writes only what changed (it runs every display tick). */
  show(clock: PickClock | undefined): void;
}

const ICON_PX = 36;

/**
 * A live match's pick card (ADR 0055, B2): the title (whose pick, with the small waiting ball while
 * the other picks), the seconds at its end, and a bar across it, calm lilac until 10 s and then the
 * accent yellow, the seconds the same size, no flashing, no sound. The waiting player also sees
 * what the other is answering and the balls they pick from. The same card on both phones; before
 * the match starts, the 60 s to join; while the other is away, their grace. The bar glides; with
 * reduced motion it steps once a second.
 */
export function createPickClock(lookup: DefinitionLookup, panel: HTMLElement): PickClockCard {
  const root = element('section', 'pick-clock');
  const head = element('div', 'pick-clock-head');
  const title = element('h2', 'pick-clock-title');
  const titleText = element('span', 'pick-clock-title-text');
  // While it waits on the other player: the one waiting ball (waiting.ts), small, by the title.
  const ball = waitingBall('small');
  title.append(titleText, ball);
  const seconds = element('span', 'pick-clock-seconds');
  head.append(title, seconds);
  const bar = element('div', 'pick-clock-bar');
  bar.setAttribute('aria-hidden', 'true');
  const fill = element('div', 'pick-clock-fill');
  bar.append(fill);
  const answer = element('div', 'pick-clock-answer');
  const answerLine = element('p', 'pick-clock-answer-line');
  const balls = element('div', 'pick-clock-balls');
  answer.append(answerLine, balls);
  root.append(head, bar, answer);
  root.hidden = true;
  const next = element('p', 'pick-clock-next');
  next.hidden = true;
  // The card above the series' track, what happens next under it.
  const track = panel.querySelector('#series-track');
  track?.before(root);
  track?.after(next);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let drawn = '';
  let width = '';

  return {
    element: root,
    show(clock) {
      setHidden(root, clock === undefined);
      setHidden(next, clock?.next === undefined);
      if (clock === undefined) return;
      setAttr(root, 'data-kind', clock.kind);
      setAttr(root, 'data-urgent', String(clock.urgent));
      setText(titleText, clock.title);
      // Every wait on the other player shows it, not only their pick (ADR 0087 addendum).
      const waits = clock.kind === 'theirs' || clock.kind === 'join' || clock.waiting === true;
      setHidden(ball, !waits);
      setText(seconds, `${String(clock.seconds)} s`);
      // Reduced motion: the bar steps with the seconds; else it follows the time and glides.
      const left = reducedMotion.matches ? Math.min(1, clock.seconds / clock.total) : clock.left;
      const scale = (Math.round(left * 1000) / 1000).toString();
      if (scale !== width) {
        width = scale;
        fill.style.transform = `scaleX(${scale})`;
      }
      setText(next, clock.next ?? '');
      const answering = clock.answering;
      setHidden(answer, answering === undefined);
      if (answering === undefined) return;
      setText(answerLine, answering.line);
      const key = answering.from.join(',');
      if (key === drawn) return;
      drawn = key;
      balls.replaceChildren(
        ...answering.from.map((id) => {
          const icon = element('canvas', 'pick-clock-ball');
          const ball = lookup.get(id);
          icon.setAttribute('role', 'img');
          icon.setAttribute('aria-label', ball?.name ?? id);
          if (ball !== undefined) drawBallIcon(icon, ball, ICON_PX);
          return icon;
        }),
      );
    },
  };
}
