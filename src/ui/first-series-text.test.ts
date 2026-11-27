import { describe, expect, it } from 'vitest';
import {
  FIRST_VISIT,
  firstPickSteps,
  formatSteps,
  NEW_TAG,
  newWays,
  NEW_WAYS_TITLE,
  NEW_WAYS_WHERE,
  SERIES_STEPS,
  SHOW_FIRST_LINE,
} from './first-series-text.ts';
import { FORMAT_LINES } from './series-text.ts';
import { SYMBOLS } from './symbols.ts';

describe('the first series’ words (ADR 0090)', () => {
  it('teaches a series in three short lines over the first lineup', () => {
    expect(SERIES_STEPS.title).toBe('How a series goes');
    expect(SERIES_STEPS.items).toHaveLength(3);
    // Each fits a line at 375 px.
    for (const line of SERIES_STEPS.items) expect(line.length).toBeLessThanOrEqual(52);
  });

  it('says what ▲ means at the first pick, in the odds the marks themselves give', () => {
    const steps = firstPickSteps('Banshee');
    expect(steps.title).toBe('Your first pick');
    expect(steps.items).toStrictEqual([]);
    expect(steps.note).toMatch(/^▲ under Banshee: your ball is favoured/);
    expect(SYMBOLS.favoured.meaning).toContain('about 6 in 10');
    expect(steps.note).toContain('6 in 10');
    expect(SYMBOLS.strongFavoured.meaning).toContain('about 7 in 10');
    expect(steps.note).toContain('▲▲: 7 in 10');
    expect(steps.note).toMatch(/The lit row is your best answer.$/);
  });

  it('says the other side of showing first in round 2', () => {
    expect(SHOW_FIRST_LINE).toBe('The bot sees your ball before it answers.');
  });

  it('names the new ways to play once it is over, a friend only where the build has one', () => {
    const online = newWays(true).map((way) => way.text);
    expect(NEW_WAYS_TITLE).toBe('New: more ways to play');
    expect(online).toContain('Play a friend with a link.');
    expect(NEW_WAYS_WHERE).toBe('They’re in What to play on the Play tab.');
    expect(
      newWays(false)
        .map((way) => way.text)
        .join(' '),
    ).not.toContain('friend');
  });

  it('teaches Showdown and Blind with their rule sentences, and Reveal by playing it', () => {
    expect(formatSteps('reveal')).toBeUndefined();
    expect(formatSteps('showdown')?.title).toBe('How Showdown goes');
    expect(formatSteps('showdown')?.items[0]).toBe(FORMAT_LINES.showdown);
    expect(formatSteps('blind')?.title).toBe('How Blind goes');
    expect(formatSteps('blind')?.items[0]).toBe(FORMAT_LINES.blind);
    expect(NEW_TAG).toBe('New');
  });

  it('opens home with the pitch, what Play starts and the skip', () => {
    expect(FIRST_VISIT.pitch).toBe('Pick 3 balls. Watch them fight. Outguess the bot.');
    expect(FIRST_VISIT.play).toBe('Your first series · vs Easy bot');
    expect(FIRST_VISIT.playSpoken).toContain('Easy bot');
    expect(FIRST_VISIT.skip).toBe('Skip: show me everything');
  });
});
