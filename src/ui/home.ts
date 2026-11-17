import { createSettingsToggle } from './settings-menu.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import type { SeriesState } from '../sim/series.ts';
import type { Opponent, PlaySetup } from '../app/modes.ts';
import {
  BALL_MANUAL,
  FREE_PLAY,
  OPPONENT_CARDS,
  PLAY_LABEL,
  playLine,
  playSpoken,
  RESUME_PLAY,
  resumeLine,
  resumeSpoken,
} from './modes-text.ts';

export interface HomeActions {
  /** Play (ADR 0055): the last series set up against the bot, straight to its lineup; or, with a
   * series held, carry on with it. */
  readonly onPlay: () => void;
  /** With a series held: forget it and start a fresh one. */
  readonly onNewSeries: () => void;
  /** An opponent's card: its setup screen. */
  readonly onOpponent: (opponent: Opponent) => void;
  readonly onFreePlay: () => void;
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
  /**
   * Play with what it starts (`setup`), or Resume series with its format and score while one is
   * held, and New series.
   */
  setPlay(setup: PlaySetup, held: SeriesState | undefined): void;
  /** Moves focus to Play (or Resume series): the one obvious first action. */
  focus(): void;
}

const STRIP_ICON_PX = 28;
const SOURCE_URL = 'https://github.com/Lyfe4/ball-battle';

/**
 * The front door, phone first (ADR 0055): the live demo match on the arena above, then which balls
 * are playing, the name, the pitch (a strategy game about building a lineup; counters are for the
 * manual to reveal, not the headline), a large Play that says what it starts (the player's last
 * series against the bot), one card per opponent under it, then Free play and the manual as quiet
 * links. On a wide screen it sits beside the arena with the roster's drawings as a strip.
 */
export function createHome(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  opponents: readonly Opponent[],
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

  // Play leads, one tap to the remembered series' lineup, saying what it plays (ADR 0055).
  const play = element('button', 'hud-button hud-button-primary home-play');
  // One of the few buttons that tap (sound.ts): Play is a key moment.
  play.dataset['sound'] = 'tap';
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

  // One card per opponent, each opening its setup: two today, a 2 x 2 grid with Ranked and Casual.
  const cards = element('ul', 'home-cards');
  cards.setAttribute('aria-label', 'Choose who to play');
  cards.append(
    ...opponents.map((opponent) => {
      const item = element('li', 'home-cards-item');
      const card = element('button', 'home-card');
      card.type = 'button';
      card.dataset['opponent'] = opponent;
      // The title alone: "vs Bot" and "vs Friend" say who it plays.
      card.append(element('span', 'home-card-name', OPPONENT_CARDS[opponent].name));
      card.addEventListener('click', () => {
        actions.onOpponent(opponent);
      });
      item.append(card);
      return item;
    }),
  );

  const link = (text: string, onClick: () => void) => {
    const button = element('button', 'text-link home-link', text);
    button.type = 'button';
    // Named by its words alone: the chevron the link style adds is decoration.
    button.setAttribute('aria-label', text);
    button.addEventListener('click', onClick);
    return button;
  };
  const more = element('div', 'home-more');
  more.append(link(FREE_PLAY, actions.onFreePlay), link(BALL_MANUAL, actions.onManual));

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
  root.append(demo, head, pitch, playRow, cards, more, strip, footer);

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
    setPlay(setup, held) {
      setText(playLabel, held === undefined ? PLAY_LABEL : RESUME_PLAY.label);
      setText(playMeta, held === undefined ? playLine(setup) : resumeLine(held));
      play.setAttribute('aria-label', held === undefined ? playSpoken(setup) : resumeSpoken(held));
      fresh.hidden = held === undefined;
    },
    focus() {
      play.focus();
    },
  };
}
