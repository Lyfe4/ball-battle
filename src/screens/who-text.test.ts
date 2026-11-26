import { describe, expect, it } from 'vitest';
import { friendBox, liveLine, noneOnlineLine, othersTitle, showAll } from './who-text.ts';

describe('the words of "Who do you want to play?" (ADR 0089)', () => {
  it('says the Play box with a friend picked, live or by turns, and what Play starts', () => {
    expect(friendBox('Robin', false, { format: 'reveal', bestOf: 3 })).toStrictEqual({
      who: 'vs Robin',
      rules: 'Live · Best of 3 · Reveal',
      spoken: 'vs Robin, Live · Best of 3 · Reveal: what to play',
      play: 'Challenge Robin live, Best of 3 · Reveal',
      initial: 'R',
    });
    const turns = friendBox('Jo', true, { format: 'showdown', bestOf: 5 });
    expect([turns.rules, turns.play]).toStrictEqual([
      'By turns · Best of 5 · Showdown',
      'Play Jo by turns, Best of 5 · Showdown',
    ]);
  });

  it('names the groups and the lines under them', () => {
    expect(liveLine({ format: 'showdown', bestOf: 5 })).toBe('Live now, Best of 5 · Showdown.');
    expect([othersTitle(true, 3), othersTitle(false, 3)]).toStrictEqual([
      'Not online',
      'Friends · 3',
    ]);
    expect(noneOnlineLine(false)).toBe('None of your friends is online right now.');
    expect(showAll(18)).toBe('Show all 18 friends');
  });
});
