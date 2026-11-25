import { describe, expect, it } from 'vitest';
import { backWords } from './back-to-match-text.ts';

describe('home’s way back to a live match', () => {
  it('names the opponent and what is played', () => {
    expect(
      backWords({ kind: 'series', id: 'x', format: 'reveal', bestOf: 3, opponent: 'Player 4821' }),
    ).toMatchObject({ label: 'Back to your match', meta: 'vs Player 4821 · Best of 3 · Reveal' });
  });

  it('says a lobby is still waiting for the friend', () => {
    expect(
      backWords({ kind: 'lobby', token: 't', format: 'showdown', bestOf: 5, invitee: null }),
    ).toMatchObject({
      label: 'Back to your lobby',
      meta: 'Waiting for your friend · Best of 5 · Showdown',
    });
  });
});
