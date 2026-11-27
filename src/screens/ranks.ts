// The Ranks tab (ADR 0081), in builds with accounts only (previews and staging): one coming-soon
// card (coming-soon.ts, ADR 0090 D5) that reads nothing, saying ranked is coming, and a way on:
// play a friend now. It ships to production once it holds one real thing.
import { createComingSoon } from '../ui/coming-soon.ts';
import { element } from '../ui/dom.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import { RANKS } from './ranks-text.ts';

export interface RanksHost {
  /** Back: Play, as the tab Back rule says. */
  readonly back: () => void;
  /** Its way on: a friend match, by a link (the send screen). */
  readonly playFriend: () => void;
}

export interface RanksScreen {
  setVisible(visible: boolean): void;
  /** Shows the tab, its heading focused. */
  show(): void;
}

export function createRanks(root: HTMLElement, host: RanksHost): RanksScreen {
  root.setAttribute('aria-label', RANKS.title);
  root.classList.add('ranks-screen');
  const header = createScreenHeader(RANKS.title, 'Back', host.back, { tab: 'ranks' });
  const body = element('div', 'ranks');
  const intro = element('p', 'ranks-intro', RANKS.intro);
  const card = createComingSoon(RANKS.card.title, [], RANKS.card.line);
  const play = element('button', 'hud-button hud-button-primary', RANKS.button);
  play.type = 'button';
  play.addEventListener('click', host.playFriend);
  // The card in the boards' box: on a desktop it fills the main column beside the intro and its
  // button (frame.css, ADR 0087); on a phone it stands between them, as one column.
  const boards = element('div', 'ranks-boards');
  boards.append(card);
  body.append(intro, boards, play);
  root.replaceChildren(header.element, body);
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show() {
      header.focus();
    },
  };
}
