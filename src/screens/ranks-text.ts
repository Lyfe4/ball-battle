// What the Ranks tab says (ADR 0081, 0090 D5): what ranks will be, one card saying plainly that
// ranked play is coming and what to do until then, and that way on. Pure, so the words are tested
// without a DOM.
export const RANKS = {
  title: 'Ranks',
  intro: 'Ranks open with ranked play: trophies for online wins.',
  card: { title: 'Ranked is coming', line: 'Until then, play a friend.' },
  button: 'Play a friend now',
} as const;
