// The one look of a wait on another player (ADR 0086, 0087 addendum of 2026-11-27): a ball rising
// and falling over its shadow. Every such wait shows it: the lobby (a friend's or a link's), a
// lineup waiting for the other's, a rematch asked, a pick or a move by turns the other owes. The
// card (`createWaiting`) is the ball over a title and one quiet line; a card that is already a
// title (the pick clock) takes the small ball alone (`waitingBall`). A friend's disc sits beside
// the title, never in the ball's place.
//
// Screens redraw their waits every few seconds (the lobby re-reads its challenge), and a new
// element would start its loop again from the bottom: a jump. So every ball keeps time with the
// page, not with its element: its loop is offset by the page's clock when it is made, and a ball
// made at any moment is where every other ball is. Under reduced motion it is still.
import { element } from './dom.ts';
import { personDisc } from './online/friend-sheet.ts';
import type { WaitingContent } from './waiting-content.ts';

export type { WaitingContent } from './waiting-content.ts';

export type WaitingBallSize = 'large' | 'small';

/** The ball, keeping time with the page (waiting.css): decoration, hidden from screen readers. */
export function waitingBall(size: WaitingBallSize = 'large'): HTMLElement {
  const ball = element('span', 'waiting-ball');
  ball.dataset['size'] = size;
  ball.setAttribute('aria-hidden', 'true');
  // How far into the page's life it is made: the loop starts that far in (a negative delay), on
  // the animations' own clock (the frame's time). A CSS animation only gets its start time on the
  // next frame, so on a busy page it would start late by that frame and sit a pixel or two off
  // the balls before it: once it is on the page, its start is pinned to that same clock, so every
  // ball's loop is the page's time exactly.
  const clock = document.timeline.currentTime;
  const since = typeof clock === 'number' ? clock : performance.now();
  ball.style.setProperty('--waiting-since', `-${String(since)}ms`);
  requestAnimationFrame(() => {
    for (const animation of ball.getAnimations({ subtree: true })) animation.startTime = since;
  });
  return ball;
}

/** The waiting card: the ball, the title (with the friend's disc), the line. */
export function createWaiting(content: WaitingContent): HTMLElement {
  const card = element('div', 'waiting');
  const title = element('h2', 'waiting-title');
  if (content.who !== undefined) {
    const disc = personDisc({ id: '', name: content.who }, 'row');
    disc.classList.add('waiting-disc');
    title.append(disc);
  }
  title.append(element('span', 'waiting-title-text', content.title));
  card.append(waitingBall(), title, element('p', 'waiting-line', content.line));
  return card;
}
