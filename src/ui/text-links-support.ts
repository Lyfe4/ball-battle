// The text links drawn as <button>s that only go somewhere (ADR 0086, 0087: a text link only
// navigates; an action is a button or a sheet row), by their other class. `text-links.test.ts` reads
// the code against it, and `controls-look` the page.

/** Each text-link button, by its other class, and where it goes. */
export const NAVIGATING: Readonly<Record<string, string>> = {
  'play-box': 'opens What to play (a box drawn as a link, ADR 0081 addendum)',
  'home-link': 'Free play’s setup',
  'skeleton-home': 'home, from a screen still loading',
  'profile-all': 'All matches, Profile’s own screen (ADR 0089)',
  'who-sheet-add': 'the Friends tab, to add a friend (ADR 0089)',
  'who-lobby-sign-in': 'sign-in, from a guest’s lobby (ADR 0089)',
  'series-leave': 'home, from a series by turns (a live match’s is a button: it forfeits)',
};
