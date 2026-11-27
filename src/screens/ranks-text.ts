// What the Ranks tab says (ADR 0081, 0090 D5 and its addendum): one card saying plainly that ranked
// play is coming, what it will be and what to do until then, and that way on. Said once: no intro
// over the card. Pure, so the words are tested without a DOM.
export const RANKS = {
  title: 'Ranks',
  card: {
    title: 'Ranked is coming',
    line: 'Trophies for online wins. Until then, play a friend.',
  },
  button: 'Play a friend now',
} as const;
