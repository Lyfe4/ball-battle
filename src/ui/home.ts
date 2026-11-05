import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setText } from './dom.ts';

export interface HomeActions {
  readonly onPlay: () => void;
  readonly onSeries: () => void;
  readonly onManual: () => void;
  /** Reduced motion: the demo waits on a still frame until asked to play. */
  readonly onWatch: () => void;
}

export interface Home {
  setVisible(visible: boolean): void;
  /** Says which demo match is on the arena, and why its first ball is favoured. */
  showDemo(favoured: string, other: string, reason: string): void;
  /** Shows the Watch button while the demo waits (reduced motion). */
  setWaiting(waiting: boolean): void;
  /** Moves focus to Play: the one obvious first action. */
  focus(): void;
}

const STRIP_ICON_PX = 28;
const SOURCE_URL = 'https://github.com/Lyfe4/ball-battle';

/**
 * The front door, phone first: the live demo match on the arena above, then what is playing and
 * why, the name, one line on what the game is, a large Play, and Best of 3 beside it. On a wide
 * screen it sits beside the arena with the roster's drawings as a strip.
 */
export function createHome(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  actions: HomeActions,
): Home {
  root.replaceChildren();
  root.classList.add('home');
  const byId = new Map(balls.map((ball) => [ball.id, ball]));

  const demo = element('section', 'home-demo');
  demo.setAttribute('aria-label', 'Demo match');
  const demoLine = element('p', 'home-demo-line');
  const demoReason = element('p', 'home-demo-reason');
  const watch = element('button', 'hud-button home-watch', 'Watch the demo');
  watch.type = 'button';
  watch.addEventListener('click', actions.onWatch);
  demo.append(demoLine, demoReason, watch);

  const title = element('h1', 'home-title', 'BallBattle');
  const pitch = element(
    'p',
    'home-pitch',
    'Pick two balls and watch them fight. You don’t steer: every ball has an ability, and each one beats some balls and loses to others.',
  );

  const play = element('button', 'hud-button hud-button-primary home-play', 'Play');
  play.type = 'button';
  play.addEventListener('click', actions.onPlay);
  const series = element('button', 'hud-button', 'Best of 3 vs bot');
  series.type = 'button';
  series.addEventListener('click', actions.onSeries);
  const manual = element('button', 'hud-button', 'Ball manual');
  manual.type = 'button';
  manual.addEventListener('click', actions.onManual);
  const more = element('div', 'home-more');
  more.append(series, manual);

  const strip = element('ul', 'home-strip');
  strip.setAttribute('aria-label', `${String(balls.length)} balls`);
  strip.append(
    ...balls.map((ball) => {
      const item = element('li', 'home-strip-ball');
      const icon = element('canvas', 'home-strip-icon');
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', ball.name);
      drawBallIcon(icon, ball, STRIP_ICON_PX);
      item.append(icon);
      return item;
    }),
  );

  const source = element('a', 'text-link home-source', 'Source on GitHub');
  source.href = SOURCE_URL;
  source.rel = 'noopener';
  const footer = element('p', 'home-footer');
  footer.append(source);

  root.append(demo, title, pitch, play, more, strip, footer);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    showDemo(favoured, other, reason) {
      const name = (id: string) => byId.get(id)?.name ?? id;
      setText(
        demoLine,
        `Demo: ${name(favoured)} vs ${name(other)}. ${name(favoured)} is favoured.`,
      );
      setText(demoReason, reason);
    },
    setWaiting(waiting) {
      watch.hidden = !waiting;
    },
    focus() {
      play.focus();
    },
  };
}
