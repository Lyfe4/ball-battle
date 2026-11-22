// What home's account entry shows for what `/me` said (account-button.ts): pure, so every state is
// tested without a DOM.
import type { WhoAmI } from '../../app/who-am-i.ts';

/** The first letter or digit of a username, as a capital (names are a-z, digits and `_`). */
export function initialOf(username: string): string {
  return /[A-Za-z0-9]/.exec(username)?.[0]?.toUpperCase() ?? '?';
}

/** What the button shows for `who`: its look, its words (if any) and its accessible name. */
export function accountLook(who: WhoAmI): {
  readonly look: 'initial' | 'sign-in' | 'face';
  readonly text: string;
  readonly label: string;
} {
  switch (who.kind) {
    case 'account':
      return who.username === null
        ? { look: 'face', text: '', label: 'Your account' }
        : {
            look: 'initial',
            text: initialOf(who.username),
            label: `Your account, ${who.username}`,
          };
    case 'guest':
    case 'none':
      return { look: 'sign-in', text: 'Sign in', label: 'Sign in' };
    case 'unknown':
      return { look: 'face', text: '', label: 'Your account' };
  }
}
