// What the avatar shows for what `/me` said (account-button.ts, ADR 0081): pure, so every state is
// tested without a DOM.
import type { WhoAmI } from '../../app/who-am-i.ts';

/** A letter, a digit or a pictograph: what may stand for a name. */
const NAMEABLE = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;

/**
 * The first whole character of a name that may stand for it, as a capital: a grapheme
 * (`Intl.Segmenter`), so "łukasz" shows "Ł" and an emoji or an accent made of several code points
 * shows whole. Leading `_` and the like are skipped; a name of none at all is "?".
 */
export function initialOf(name: string): string {
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name);
  for (const { segment } of graphemes) {
    if (NAMEABLE.test(segment)) return segment.toLocaleUpperCase();
  }
  return '?';
}

/** What the avatar shows for `who`: its look, its words (if any) and its accessible name. */
export function accountLook(who: WhoAmI): {
  readonly look: 'initial' | 'face';
  readonly text: string;
  readonly label: string;
} {
  if (who.kind === 'account' && who.username !== null) {
    return { look: 'initial', text: initialOf(who.username), label: `Profile, ${who.username}` };
  }
  // A guest, nobody, an account without a username, or not known: the plain face, which claims
  // nothing (Profile says who, and holds Sign in).
  return { look: 'face', text: '', label: 'Profile' };
}
