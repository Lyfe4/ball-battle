import { describe, expect, it } from 'vitest';
import type { RematchView } from '../api/rematch.ts';
import { rematchChoiceOf, rematchClockOf, rematchEnding } from './rematch-text.ts';

const T = 1_700_000_000_000;
const rematch = (over: Partial<RematchView> = {}): RematchView => ({
  state: 'none',
  askedBy: null,
  declinedBy: null,
  deadline: null,
  now: T,
  lineupIn: false,
  seriesId: null,
  offered: true,
  ...over,
});
const asked = (by: 'a' | 'b') => rematch({ state: 'asked', askedBy: by, deadline: T + 21_000 });

describe('a rematch on the end screen (ADR 0055)', () => {
  it('offers Rematch while one may be asked, and Rematch or No thanks to the one asked', () => {
    expect(rematchChoiceOf(rematch(), 'a')).toBe('offer');
    expect(rematchChoiceOf(rematch({ offered: false }), 'a')).toBeUndefined();
    expect(rematchChoiceOf(asked('b'), 'a')).toBe('answer');
    expect(rematchChoiceOf(asked('a'), 'a')).toBeUndefined();
  });

  it('counts the answer down on the pick card, from both sides', () => {
    expect(rematchClockOf(asked('b'), 'a', 'Player 4821', T)).toMatchObject({
      kind: 'rematch',
      title: 'Player 4821 wants a rematch',
      seconds: 21,
      total: 30,
      urgent: false,
    });
    expect(rematchClockOf(asked('a'), 'a', 'Player 4821', T)?.title).toBe(
      'Waiting for Player 4821 to answer',
    );
    expect(rematchClockOf(rematch(), 'a', 'Player 4821', T)).toBeUndefined();
  });

  it('counts the lineups down once both said yes', () => {
    const agreed = rematch({ state: 'agreed', askedBy: 'a', deadline: T + 50_000, lineupIn: true });
    expect(rematchClockOf(agreed, 'b', 'Player 1', T)).toMatchObject({
      title: 'Waiting for Player 1’s lineup',
      seconds: 50,
      total: 60,
    });
  });

  it('says plainly why there is no rematch, to both players', () => {
    const no = rematch({ state: 'declined', askedBy: 'a', declinedBy: 'b' });
    expect(rematchEnding(no, 'a', 'Player 4821')).toBe('Player 4821 said no to a rematch.');
    expect(rematchEnding(no, 'b', 'Player 1')).toBe('You said no to a rematch.');
    expect(rematchEnding(rematch({ state: 'expired' }), 'a', 'Player 4821')).toBe(
      'No rematch: time ran out.',
    );
    expect(rematchEnding(asked('a'), 'a', 'Player 4821')).toBeUndefined();
  });
});
