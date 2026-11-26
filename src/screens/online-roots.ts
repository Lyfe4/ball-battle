// The online screens' sections (online.ts): beside the offline screens in the HUD, before the
// health bars, each hidden until its screen shows; and the series' way out under them.
import { element } from '../ui/dom.ts';

const SECTIONS = {
  challengeNotice: ['online-challenge', 'Challenge'],
  challengeLoading: ['online-challenge-loading', 'Challenge'],
  lineupRoot: ['online-lineup', 'Your lineup'],
  seriesNotice: ['online-series-notice', 'Online series'],
  seriesLoading: ['online-series-loading', 'Online series'],
  panel: ['online-series', 'Online series'],
  signInNotice: ['online-signin', 'Sign in'],
  signInLoading: ['online-signin-loading', 'Sign in'],
  profileNotice: ['online-profile', 'Profile'],
  profileLoading: ['online-profile-loading', 'Profile'],
  matchesRoot: ['online-matches', 'All matches'],
  friendsRoot: ['online-friends', 'Friends'],
} as const;

export type OnlineRoots = { readonly [K in keyof typeof SECTIONS]: HTMLElement } & {
  readonly exit: HTMLElement;
};

export function createOnlineRoots(hud: HTMLElement, foot: HTMLElement): OnlineRoots {
  const status = hud.querySelector('#hud-status');
  const made = Object.fromEntries(
    Object.entries(SECTIONS).map(([name, [id, label]]) => {
      const node = element('section', '');
      node.id = id;
      node.setAttribute('aria-label', label);
      node.hidden = true;
      hud.insertBefore(node, status);
      return [name, node];
    }),
  ) as { [K in keyof typeof SECTIONS]: HTMLElement };
  const exit = element('div', 'series-exit');
  exit.hidden = true;
  foot.append(exit);
  return { ...made, exit };
}
