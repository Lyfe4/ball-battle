import { describe, expect, it } from 'vitest';
import { resultWords, scoreText } from './series-text.ts';
import { playerSeats } from './series/seats.ts';

describe('the score line mid-fight', () => {
  const line = { round: 0, you: 0, bot: 0, open: false };

  it('names the bot as ever', () => {
    expect(scoreText(line)).toBe('Round 1 · You 0–0 Bot');
  });

  it('shortens a guest’s name so the line fits a 390 px phone, never in its spoken name', () => {
    const seats = playerSeats('a', 'Player 6066');
    expect(scoreText(line, seats, true)).toBe('Round 1 · You 0–0 P6066');
    expect(scoreText(line, seats)).toBe('Round 1 · You 0–0 Player 6066');
    expect(scoreText(line, playerSeats('b', 'Deleted player'), true)).toBe(
      'Round 1 · You 0–0 Deleted player',
    );
  });
});

describe('the end of a series, as its sticker says it (ADR 0055)', () => {
  const seats = playerSeats('a', 'Player 4821');

  it('says who won and the score from the player’s side', () => {
    expect(resultWords('a', seats, { a: 2, b: 1 })).toStrictEqual({
      title: 'You win',
      below: '2–1 vs Player 4821',
      spoken: 'You win 2–1',
    });
  });

  it('calls a loss by one round a close one, and a wider loss by its winner', () => {
    expect(resultWords('b', seats, { a: 1, b: 2 })).toMatchObject({
      title: 'Close one',
      below: '1–2 vs Player 4821',
      spoken: 'Player 4821 wins 2–1',
    });
    expect(resultWords('a', playerSeats('b', 'Player 7'), { a: 3, b: 0 })).toMatchObject({
      title: 'Player 7 wins',
      below: 'You 0–3',
    });
  });

  it('says when nobody won', () => {
    expect(resultWords(undefined, seats, { a: 0, b: 0 }).title).toBe('No winner');
  });
});
