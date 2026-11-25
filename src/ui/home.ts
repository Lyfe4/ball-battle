import { createSettingsToggle } from './settings-menu.ts';
import { drawBallIcon } from '../render/ball-icon.ts';
import type { BallDefinition } from '../sim/types.ts';
import { element, setHidden, setText } from './dom.ts';
import type { SeriesState } from '../sim/series.ts';
import type { Opponent, PlayChoice } from '../app/modes.ts';
import { busyOnClick } from './busy-button.ts';
import { shapeIcon } from './icons.ts';
import { createPlaySheet } from './play-sheet.ts';
import {
  boxRules,
  boxSpoken,
  boxWho,
  FREE_PLAY,
  friendPlaySpoken,
  PLAY_LABEL,
  playSpoken,
  RESUME_PLAY,
  resumeLine,
  resumeSpoken,
} from './modes-text.ts';

export interface HomeActions {
  /**
   * Play (ADR 0055, 0081): what the box says. Against the bot, its series straight to the lineup,
   * or with a series held, carry on with it; against a friend, a live challenge sent and its link
   * to share. A promise is a request: Play stays busy until the next screen can show.
   */
  readonly onPlay: (choice: PlayChoice) => unknown;
  /** With a series held: forget it and start a fresh one. */
  readonly onNewSeries: () => void;
  /** The sheet changed what Play starts: remembered on this device. */
  readonly onChoice: (choice: PlayChoice) => void;
  readonly onFreePlay: () => void;
  /** The status strip: the Friends tab, where what it says waits (ADR 0081). */
  readonly onStatus: () => void;
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
   * The box says what Play starts (`choice`), Play says it too, or against the bot with a series
   * held, Resume series with its format and score, and New series.
   */
  setPlay(choice: PlayChoice, held: SeriesState | undefined): void;
  /**
   * Arriving on the tab (a visit, a tab, Back): the sheet closes if it was open, and focus moves to
   * Play (or Resume series), the one obvious first action.
   */
  arrive(): void;
  /** The status strip's line, or nothing: it hides (ADR 0081, never "0 friends online"). */
  setStatus(line: string | undefined): void;
}

const STRIP_ICON_PX = 28;

/**
 * The Play tab (ADR 0081), phone first: the title row with the gear at the top, the live demo
 * match on the arena, which balls are playing, the status strip (filled by the inbox), the mode box
 * saying what Play starts (it opens "What to play", play-sheet.ts), one large Play, then Free play
 * as a quiet link, and Privacy · Terms at the end. On a wide screen it sits beside the arena, with
 * the pitch line and the roster's drawings as a strip on a desktop.
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

  // What waits on the player and who is online, from the inbox (ADR 0081): a link to the Friends
  // tab, its arrow the one our links draw (`.text-link::after`); hidden while it has nothing.
  const status = element('button', 'text-link home-status');
  status.type = 'button';
  status.hidden = true;
  const statusText = element('span', 'home-status-text');
  status.append(statusText);
  status.addEventListener('click', actions.onStatus);

  let choice: PlayChoice | undefined;
  let held: SeriesState | undefined;

  // What Play starts, in one tappable box (ADR 0081 addendum, Option B): who, then the rules; its
  // arrow the one every link draws (`.text-link::after`). It opens the sheet that changes them.
  const box = element('button', 'text-link play-box');
  box.type = 'button';
  box.setAttribute('aria-haspopup', 'dialog');
  const boxIcon = element('span', 'play-box-icon');
  const boxWhoLine = element('span', 'play-box-who');
  const boxRulesLine = element('span', 'play-box-rules');
  box.append(boxIcon, boxWhoLine, boxRulesLine);
  let iconOf: Opponent | undefined;
  const sheet = createPlaySheet(opponents, {
    onChange: (next) => {
      choice = next;
      actions.onChoice(next);
      showPlay();
    },
    onClosed: () => {
      if (!root.hidden) box.focus({ preventScroll: true });
    },
  });
  box.addEventListener('click', () => {
    if (choice !== undefined) sheet.open(choice);
  });

  // Play leads, one tap to what it says it starts (ADR 0055).
  const play = element('button', 'hud-button hud-button-primary home-play');
  // One of the few buttons that tap (sound.ts): Play is a key moment.
  play.dataset['sound'] = 'tap';
  play.type = 'button';
  const playLabel = element('span', 'home-play-label');
  const playMeta = element('span', 'home-play-meta');
  play.append(playLabel, playMeta);
  busyOnClick(play, () => (choice === undefined ? undefined : actions.onPlay(choice)));
  // With a series held, Play resumes it; a quiet link beside it starts afresh instead.
  const fresh = element('button', 'text-link home-new-series', 'New series');
  fresh.type = 'button';
  fresh.addEventListener('click', actions.onNewSeries);
  // The box and Play are one row: "Back to your match" takes their place (online-mount.ts).
  const playRow = element('div', 'home-play-row');
  playRow.append(box, play, fresh);

  const link = (text: string, onClick: () => void) => {
    const button = element('button', 'text-link home-link', text);
    button.type = 'button';
    // Named by its words alone: the chevron the link style adds is decoration.
    button.setAttribute('aria-label', text);
    button.addEventListener('click', onClick);
    return button;
  };
  const more = element('div', 'home-more');
  more.append(link(FREE_PLAY, actions.onFreePlay));

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
  head.dataset['tabHead'] = 'play';
  head.append(title, createSettingsToggle());
  root.append(head, demo, pitch, status, playRow, more, strip, footer, sheet.element);

  /** The box and Play as the choice and the held series say. */
  function showPlay(): void {
    if (choice === undefined) return;
    if (iconOf !== choice.opponent) {
      iconOf = choice.opponent;
      boxIcon.replaceChildren(shapeIcon(choice.opponent, 'play-box-shape'));
    }
    setText(boxWhoLine, boxWho(choice));
    setText(boxRulesLine, boxRules(choice));
    box.setAttribute('aria-label', boxSpoken(choice));
    const bot = choice.opponent === 'bot';
    const resumed = bot ? held : undefined;
    setText(playLabel, resumed === undefined ? PLAY_LABEL : RESUME_PLAY.label);
    // Play's rules are the box's, said to a screen reader in Play's name; a held series has its
    // own (its format and score), so Resume series shows them.
    setText(playMeta, resumed === undefined ? '' : resumeLine(resumed));
    setHidden(playMeta, resumed === undefined);
    let spoken = friendPlaySpoken(choice.friend);
    if (bot) spoken = resumed === undefined ? playSpoken(choice.bot) : resumeSpoken(resumed);
    play.setAttribute('aria-label', spoken);
    fresh.hidden = resumed === undefined;
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
      if (!visible) sheet.close();
    },
    showDemo(a, b) {
      const name = (id: string) => byId.get(id)?.name ?? id;
      setText(demoLine, `Demo match: ${name(a)} vs ${name(b)}`);
    },
    setWaiting(waiting) {
      watch.hidden = !waiting;
    },
    setPlay(next, nextHeld) {
      choice = next;
      held = nextHeld;
      showPlay();
    },
    arrive() {
      // Back with the sheet open closes it (ADR 0086), as leaving the tab does.
      sheet.close();
      // For the keyboard: no ring until a key is pressed (input-modality.ts, ADR 0086).
      play.focus();
    },
    setStatus(line) {
      setText(statusText, line ?? '');
      setHidden(status, line === undefined);
    },
  };
}
