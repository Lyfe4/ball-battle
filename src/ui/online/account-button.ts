// The avatar (ADR 0081, replacing ADR 0079's account button): on every tab screen, top right in its
// header, just before the `?` and the gear (ADR 0087 addendum of 2026-11-26); where the rail shows
// (beside, a desktop) the username sits beside its disc. A round button with the account's initial once signed in, else a plain face. It opens Profile, where
// the username, Log out and Delete account live, or Sign in and Forget me for a guest. What it shows
// is what `/me` said (who-am-i.ts); while that isn't known (asking, offline, failing) it is the
// plain face that claims nothing, so a signed-in player is never told to sign in.
import type { WhoAmI } from '../../app/who-am-i.ts';
import { accountLook } from './account-look.ts';
import { element, setAttr, setText } from '../dom.ts';

export interface AccountButton {
  readonly element: HTMLButtonElement;
  show(who: WhoAmI): void;
}

const SVG = 'http://www.w3.org/2000/svg';

/** A head and shoulders: the account, not yet known whose. */
function faceIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'account-toggle-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M12 3.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9ZM3.5 21a8.5 7 0 0 1 17 0Z');
  svg.append(path);
  return svg;
}

/** The avatar button: top right in whichever tab screen's header shows (shell.ts). */
export function createAccountButton(open: () => void): AccountButton {
  const button = element('button', 'account-toggle');
  button.type = 'button';
  button.dataset['place'] = 'head';
  const face = element('span', 'account-toggle-face');
  face.setAttribute('aria-hidden', 'true');
  // The username beside the disc where the rail shows (online.css hides it on a phone); the
  // button's accessible name already says it.
  const name = element('span', 'account-toggle-name');
  name.setAttribute('aria-hidden', 'true');
  name.hidden = true;
  button.append(face, faceIcon(), name);
  button.addEventListener('click', open);
  return {
    element: button,
    show(who) {
      const { look, text, label, name: shown } = accountLook(who);
      setAttr(button, 'data-look', look);
      setAttr(button, 'aria-label', label);
      setText(face, text);
      setText(name, shown);
      name.hidden = shown === '';
    },
  };
}

/** The avatar, showing what `/me` said. */
export interface Avatars {
  readonly head: HTMLElement;
  show(who: WhoAmI): void;
}

export function createAvatars(open: () => void): Avatars {
  const head = createAccountButton(open);
  return {
    head: head.element,
    show: (who) => {
      head.show(who);
    },
  };
}
