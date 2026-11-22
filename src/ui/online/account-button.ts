// The account entry on home (ADR 0079 addendum of 2026-11-22): beside the settings gear, a round
// button with the account's initial once signed in, or a "Sign in" pill for a guest or nobody. It
// opens the account screen, where sign-in, the username, Log out and Delete account live. What it
// shows is what `/me` said (who-am-i.ts); while that isn't known (asking, offline, failing) it is a
// plain round face that claims nothing, so a signed-in player is never told to sign in.
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

export function createAccountButton(open: () => void): AccountButton {
  const button = element('button', 'account-toggle');
  button.type = 'button';
  const face = element('span', 'account-toggle-face');
  face.setAttribute('aria-hidden', 'true');
  button.append(face, faceIcon());
  button.addEventListener('click', open);
  return {
    element: button,
    show(who) {
      const { look, text, label } = accountLook(who);
      setAttr(button, 'data-look', look);
      setAttr(button, 'aria-label', label);
      setText(face, text);
    },
  };
}
