// A rematch reaching a player away from the end screen (ADR 0055, playtest 2026-11-19): a card that
// floats at the bottom of any screen, like the new-version card, so it never moves what is on
// screen. Asked: the end screen's pick card ("Player 4821 wants a rematch", the seconds and the
// bar) with Accept and No thanks. Ended, to the one who asked: why, with OK. Each answer is a
// request: its button is busy until the server has it (busy-button.ts), so a double tap sends one.
import type { RematchNotice } from '../../screens/rematch-text.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { busyOnClick } from '../busy-button.ts';
import { element, setHidden, setText } from '../dom.ts';
import { createPickClock } from '../series/pick-clock.ts';

export interface RematchNoticeActions {
  accept(): Promise<void>;
  decline(): Promise<void>;
  /** OK on an ending: it goes. */
  dismiss(): void;
}

export interface RematchNoticeCard {
  /** Shows `notice` (asked or ended), or hides; `failure` is a line under it (a refused answer). */
  show(notice: RematchNotice | undefined, failure?: string): void;
}

/** Drawn into `root`, which floats over every screen (rematch-notice.css). */
export function createRematchNotice(
  root: HTMLElement,
  lookup: DefinitionLookup,
  actions: RematchNoticeActions,
  label = 'Rematch',
): RematchNoticeCard {
  root.classList.add('floating-notice', 'rematch-notice');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', label);
  root.hidden = true;
  const clock = createPickClock(lookup, root);
  // Read out as it comes, wherever the player is: the card's title, or why it ended.
  const said = element('p', 'rematch-notice-line');
  said.setAttribute('role', 'status');
  const failed = element('p', 'rematch-notice-failure');
  const buttons = element('div', 'hud-actions rematch-notice-actions');
  const accept = element('button', 'hud-button hud-button-primary', 'Accept');
  accept.type = 'button';
  // A key moment, like Rematch on the end screen: it taps (sound.ts).
  accept.dataset['sound'] = 'tap';
  const decline = element('button', 'hud-button', 'No thanks');
  decline.type = 'button';
  const ok = element('button', 'hud-button', 'OK');
  ok.type = 'button';
  busyOnClick(accept, () => actions.accept());
  busyOnClick(decline, () => actions.decline());
  ok.addEventListener('click', () => {
    actions.dismiss();
  });
  buttons.append(accept, decline, ok);
  root.append(clock.element, said, failed, buttons);

  return {
    show(notice, failure) {
      setHidden(root, notice === undefined || notice.kind === 'lineup');
      // Any card of this look that shows (a rematch's or a friend's challenge) marks the page.
      const shown = [...document.querySelectorAll('.rematch-notice')].some(
        (card) => card instanceof HTMLElement && !card.hidden,
      );
      document.body.toggleAttribute('data-rematch-notice', shown);
      if (notice === undefined || notice.kind === 'lineup') return;
      const asked = notice.kind === 'asked';
      // Asked or invited: Accept and No thanks; ended: OK.
      const answers = asked || notice.kind === 'invite';
      clock.show(asked ? notice.clock : undefined);
      // The line is the asked card's title once (for a screen reader), the invite, or why it ended.
      setText(said, asked ? notice.clock.title : notice.line);
      said.classList.toggle('visually-hidden', asked);
      setText(failed, failure ?? '');
      setHidden(failed, failure === undefined);
      setHidden(accept, !answers);
      setHidden(decline, !answers);
      setHidden(ok, answers);
    },
  };
}
