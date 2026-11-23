// What the Ranks tab says (ADR 0081): plainly that ranks are coming, what each part will be, and a
// way on now. Pure, so the words are tested without a DOM.
export const RANKS = {
  title: 'Ranks',
  intro:
    'Win online matches to climb. Ranks open with ranked play; until then, every match is for fun.',
  cards: [
    { title: 'Trophy road', line: 'Trophies for each online win, milestones along the way.' },
    { title: 'Friends', line: 'You and your friends, by trophies.' },
    { title: 'Everyone', line: 'The top players, this season.' },
  ],
  button: 'Play a friend now',
} as const;
