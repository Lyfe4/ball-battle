import { createSettingsToggle } from './settings-menu.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import type { SeriesState } from '../sim/series.ts';
import { MAIN_PLAY, RESUME_PLAY, resumeLine, resumeSpoken } from './modes-text.ts';

export interface HomeActions {
  /** The main mode (ADR 0046): Best of 3, Reveal, vs the bot, straight to the lineup; or, with a
   * series held, carry on with it. */
  readonly onPlay: () => void;
  /** With a series held: forget it and start a fresh one. */
  readonly onNewSeries: () => void;
  /** Every other way to play: Showdown, Blind, Free play. */
  readonly onModes: () => void;
  readonly onManual: () => void;
  /** Reduced motion: the demo waits on a still frame until asked to play. */
  readonly onWatch: () => void;
}

export interface Home {
  setVisible(visible: boolean): void;
  /** Says which demo match is on the arena. */
  showDemo(a: string, b: string): void;
  /** Shows the Watch button while the demo waits (reduced motion). */
  setWaiting(waiting: boolean): void;
  /** Play, or Resume series with its format and score while one is held, and New series. */
  setHeld(held: SeriesState | undefined): void;
  /** Moves focus to Play (or Resume series): the one obvious first action. */
  focus(): void;
}

const STRIP_ICON_PX = 28;
const SOURCE_URL = 'https://github.com/Lyfe4/ball-battle';

/**
 * The front door, phone first: the live demo match on the arena above, then which balls are
 * playing, the name, the pitch (a strategy game about building a lineup; counters are for the
 * manual to reveal, not the headline), a large Play (Best of 3, Reveal, vs the bot: the game,
 * ADR 0046), and Other modes and the manual under it. On a wide screen it sits beside the arena with the roster's drawings as a strip.
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
  const watch = element('button', 'hud-button home-watch', 'Watch the demo');
  watch.type = 'button';
  watch.addEventListener('click', actions.onWatch);
  demo.append(demoLine, watch);

  const title = element('h1', 'home-title', 'BallBattle');
  const pitch = element('p', 'home-pitch', 'Pick your balls. Watch your plan fight it out.');

  // The main mode leads, one tap to its lineup, saying what it plays; every other way to play is
  // one tap further, behind Other modes (ADR 0046).
  const play = element('button', 'hud-button hud-button-primary home-play');
  play.type = 'button';
  const playLabel = element('span', 'home-play-label');
  const playMeta = element('span', 'home-play-meta');
  play.append(playLabel, playMeta);
  play.addEventListener('click', actions.onPlay);
  // With a series held, Play resumes it; a quiet link beside it starts afresh instead.
  const fresh = element('button', 'text-link home-new-series', 'New series');
  fresh.type = 'button';
  fresh.addEventListener('click', actions.onNewSeries);
  const playRow = element('div', 'home-play-row');
  playRow.append(play, fresh);
  const modes = element('button', 'hud-button', 'Other modes');
  modes.type = 'button';
  modes.addEventListener('click', actions.onModes);
  const manual = element('button', 'hud-button', 'Ball manual');
  manual.type = 'button';
  manual.addEventListener('click', actions.onManual);
  const more = element('div', 'home-more');
  more.append(modes, manual);

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

  // The title shares its row with the settings gear (ADR 0040), at the top right of the panel.
  const head = element('div', 'home-head');
  head.append(title, createSettingsToggle());
  root.append(demo, head, pitch, playRow, more, strip, footer);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    showDemo(a, b) {
      const name = (id: string) => byId.get(id)?.name ?? id;
      setText(demoLine, `Demo match: ${name(a)} vs ${name(b)}`);
    },
    setWaiting(waiting) {
      watch.hidden = !waiting;
    },
    setHeld(held) {
      setText(playLabel, held === undefined ? MAIN_PLAY.label : RESUME_PLAY.label);
      setText(playMeta, held === undefined ? MAIN_PLAY.meta : resumeLine(held));
      play.setAttribute('aria-label', held === undefined ? MAIN_PLAY.spoken : resumeSpoken(held));
      fresh.hidden = held === undefined;
    },
    focus() {
      play.focus();
    },
  };
}
