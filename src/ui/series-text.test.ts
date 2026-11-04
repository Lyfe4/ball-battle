import { describe, expect, it } from 'vitest';
import { nextMatch, recordOutcome, startSeries, type SeriesState } from '../sim/series.ts';
import { betweenLine, finalLine, playingLine, roundLine, scoreLine } from './series-text.ts';

const nameOf = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const start = startSeries({
  seed: 1,
  a: ['speedster', 'vampire', 'archer'],
  b: ['storm', 'frost', 'quake'],
});
const after = (...outcomes: ('a' | 'b' | 'draw')[]): SeriesState =>
  outcomes.reduce(recordOutcome, start);

function next(state: SeriesState) {
  const match = nextMatch(state);
  if (match === undefined) throw new Error('expected a next match');
  return match;
}

describe('series text', () => {
  it('scores the player first', () => {
    expect(scoreLine(after('b'))).toBe('You 0 – 1 Bot');
  });

  it('describes a round from the player’s side', () => {
    const [won] = after('a').rounds;
    const [lost] = after('draw', 'b').rounds;
    if (won === undefined || lost === undefined) throw new Error('expected rounds');
    expect(roundLine(won, nameOf)).toBe('Round 1: your Speedster beat the bot’s Storm');
    expect(roundLine(lost, nameOf)).toBe(
      'Round 1: the bot’s Storm beat your Speedster, after 1 draw',
    );
  });

  it('names a sudden death and who it went to', () => {
    const [record] = after('draw', 'draw', 'draw').rounds;
    if (record === undefined) throw new Error('expected a round');
    expect(roundLine(record, nameOf)).toMatch(/drew 3 times; sudden death went to (you|the bot)$/);
  });

  it('reveals both balls only once the round is playing', () => {
    expect(playingLine(next(start), nameOf)).toBe(
      'Round 1 of 3: your Speedster vs the bot’s Storm',
    );
    const between = betweenLine(after('a'), next(after('a')), nameOf);
    expect(between).toBe('Next, round 2: your Vampire against a hidden ball.');
    expect(between).not.toContain('Frost');
  });

  it('explains a replay after a draw', () => {
    const drew = after('draw');
    expect(betweenLine(drew, next(drew), nameOf)).toContain('play 2 of 3');
    expect(playingLine(next(drew), nameOf)).toContain('(replay 2 of 3)');
  });

  it('announces the series result', () => {
    expect(finalLine(after('a', 'b', 'a'))).toBe('You win the series 2–1!');
    expect(finalLine(after('b', 'b'))).toBe('The bot wins the series 2–0.');
  });
});
