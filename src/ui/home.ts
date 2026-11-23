import { createSettingsToggle } from './settings-menu.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import type { SeriesState } from '../sim/series.ts';
import type { Opponent, PlaySetup } from '../app/modes.ts';
import { createSegmented } from './segmented.ts';
import {
  CHANGE_RULES,
  CHOOSER_LABEL,
  FREE_PLAY,
  FRIEND_PLAY_LINE,
  FRIEND_PLAY_SPOKEN,
  OPPONENT_CARDS,
  PLAY_LABEL,
  playLine,
  playSpoken,
  RESUME_PLAY,
  resumeLine,
  resumeSpoken,
} from './modes-text.ts';

export interface HomeActions {
  /** Play (ADR 0055, 0081): against the bot, the last series set up, straight to its lineup, or
   * with a series held, carry on with it; against a friend, the send screen. */
  readonly onPlay: (opponent: Opponent) => void;
  /** With a series held: forget it and start a fresh one. */
  readonly onNewSeries: () => void;
  /** Change rules: the chosen opponent's setup screen. */
  readonly onChangeRules: (opponent: Opponent) => void;
  readonly onFreePlay: () => void;
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
   * Opens on vs Bot with Play saying what it starts (`setup`), or Resume series with its format
   * and score while one is held, and New series.
   */
  setPlay(setup: PlaySetup, held: SeriesState | undefined): void;
  /** Moves focus to Play (or Resume series): the one obvious first action. */
  focus(): void;
}

const STRIP_ICON_PX = 28;

/**
 * The Play tab (ADR 0081), phone first: the title row with the gear at the top, the live demo
 * match on the arena, which balls are playing, the status strip's slot (filled by the inbox, PR 7),
 * a chooser of who to play, one large Play that says what it starts, then Change rules and Free
 * play as quiet links, and Privacy · Terms at the end. On a wide screen it sits beside the arena,
 * with the pitch line and the roster's drawings as a strip on a desktop.
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

  // What waits on the player (friends online, challenges): hidden until it has something (PR 7).
  const status = element('div', 'home-status');
  status.hidden = true;

  let setup: PlaySetup | undefined;
  let held: SeriesState | undefined;
  let chosen: Opponent = 'bot';

  // Who to play, a choice in the one look (choice.css), only where there is more than one.
  const chooser = element('div', 'home-chooser');
  const segments = createSegmented(
    chooser,
    'home-chooser',
    CHOOSER_LABEL,
    opponents.map((opponent) => ({ value: opponent, text: OPPONENT_CARDS[opponent].name })),
    chosen,
    (opponent) => {
      chosen = opponent;
      showPlay();
    },
  );
  chooser.querySelector('.segmented-label')?.classList.add('visually-hidden');
  for (const [at, button] of chooser.querySelectorAll('button').entries()) {
    const opponent = opponents[at];
    if (opponent !== undefined) button.dataset['opponent'] = opponent;
  }
  chooser.hidden = opponents.length < 2;

  // Play leads, one tap to what it says it starts (ADR 0055).
  const play = element('button', 'hud-button hud-button-primary home-play');
  // One of the few buttons that tap (sound.ts): Play is a key moment.
  play.dataset['sound'] = 'tap';
  play.type = 'button';
  const playLabel = element('span', 'home-play-label');
  const playMeta = element('span', 'home-play-meta');
  play.append(playLabel, playMeta);
  play.addEventListener('click', () => {
    actions.onPlay(chosen);
  });
  // With a series held, Play resumes it; a quiet link beside it starts afresh instead.
  const fresh = element('button', 'text-link home-new-series', 'New series');
  fresh.type = 'button';
  fresh.addEventListener('click', actions.onNewSeries);
  // The chooser and Play are one row: "Back to your match" takes their place (online-mount.ts).
  const playRow = element('div', 'home-play-row');
  playRow.append(chooser, play, fresh);

  const link = (text: string, onClick: () => void) => {
    const button = element('button', 'text-link home-link', text);
    button.type = 'button';
    // Named by its words alone: the chevron the link style adds is decoration.
    button.setAttribute('aria-label', text);
    button.addEventListener('click', onClick);
    return button;
  };
  const changeRules = link(CHANGE_RULES, () => {
    actions.onChangeRules(chosen);
  });
  const more = element('div', 'home-more');
  more.append(changeRules, link(FREE_PLAY, actions.onFreePlay));

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

  // The privacy policy and terms (ADR 0069), quiet at the very end: pages of their own.
  const page = (text: string, href: string) => {
    const anchor = element('a', 'text-link', text);
    anchor.href = href;
    return anchor;
  };
  const footer = element('p', 'home-footer');
  footer.append(page('Privacy', '/privacy.html'), page('Terms', '/terms.html'));

  // The title shares its row with the settings gear (ADR 0040): the top of the page on a phone,
  // the top of the panel beside the court.
  const head = element('div', 'home-head');
  head.append(title, createSettingsToggle());
  root.append(head, demo, pitch, status, playRow, more, strip, footer);

  /** Play as the chosen opponent and the held series say. */
  function showPlay(): void {
    if (setup === undefined) return;
    const resuming = chosen === 'bot' && held !== undefined;
    const label = resuming ? RESUME_PLAY.label : PLAY_LABEL;
    let meta = FRIEND_PLAY_LINE;
    let spoken = FRIEND_PLAY_SPOKEN;
    if (chosen === 'bot') {
      meta = held === undefined ? playLine(setup) : resumeLine(held);
      spoken = held === undefined ? playSpoken(setup) : resumeSpoken(held);
    }
    setText(playLabel, label);
    setText(playMeta, meta);
    play.setAttribute('aria-label', spoken);
    fresh.hidden = !resuming;
    // A friend's Play is its setup already: Change rules would open the same screen.
    changeRules.hidden = chosen !== 'bot';
  }

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
    setPlay(next, nextHeld) {
      setup = next;
      held = nextHeld;
      // The chooser starts on vs Bot each time the tab opens (ADR 0081).
      chosen = 'bot';
      segments.select(chosen);
      showPlay();
    },
    focus() {
      play.focus();
    },
  };
}
