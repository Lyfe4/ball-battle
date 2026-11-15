import { describe, expect, it } from 'vitest';
import { scoreText } from './series-text.ts';
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
