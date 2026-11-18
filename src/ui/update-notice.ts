// A new version is deployed (issue #17, ADR 0066): one quiet card with Reload, shown only at a calm
// moment (home, or an offline series that is over), never over a fight, a setup or anything online.
// Found mid-fight, it waits for the next calm moment. Its look is the notice surface the slow-frames
// line uses (frame-tip.css); the card floats at the bottom so it never moves what is on screen.
import { element, setHidden, setText } from './dom.ts';

export const UPDATE_TEXT = 'A new version of BallBattle is ready.';

export interface UpdateNotice {
  /** A newer build is deployed: the card shows from the next calm moment on. */
  found(): void;
  /** Whether the screen is at a calm moment now (`isCalmMoment`). */
  setCalm(calm: boolean): void;
}

/** The card drawing into `root` (`#update-notice`); `reload` is its button. */
export function createUpdateNotice(root: HTMLElement, reload: () => void): UpdateNotice {
  const text = element('p', 'update-notice-text');
  const button = element('button', 'hud-button update-notice-reload', 'Reload');
  button.type = 'button';
  button.setAttribute('aria-label', 'Reload to get the new version');
  button.addEventListener('click', reload);
  root.replaceChildren(text, button);
  let found = false;
  let calm = false;
  const show = () => {
    const shown = found && calm;
    // Written as it shows, so a screen reader hears it once (the card is a polite status).
    setText(text, shown ? UPDATE_TEXT : '');
    setHidden(root, !shown);
    document.body.toggleAttribute('data-update', shown);
  };
  return {
    found() {
      found = true;
      show();
    },
    setCalm(next) {
      if (next === calm) return;
      calm = next;
      show();
    },
  };
}
