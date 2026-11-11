import { describe, expect, it } from 'vitest';
import { OTHER_MODE_SECTIONS } from '../app/modes.ts';
import { BOT_LEVELS } from '../sim/bot.ts';
import { FORMATS } from '../sim/series.ts';
import { levelLine, MAIN_PLAY, modeLine, modeName, setupLine } from './modes-text.ts';
import { FORMAT_LINES } from './series-text.ts';

const modes = OTHER_MODE_SECTIONS.flatMap((section) => section.modes);

describe('the words for the ways to play (ADR 0046)', () => {
  it('says what home’s one tap plays, in words, not only “Play”', () => {
    expect(MAIN_PLAY.label).toBe('Play');
    expect(MAIN_PLAY.meta).toBe('Best of 3 · Reveal · vs bot');
    expect(MAIN_PLAY.spoken).toBe('Play Best of 3, Reveal, against the bot');
  });

  it('names every other mode and says how it plays in a few words', () => {
    expect(modes.map(modeName)).toStrictEqual(['Showdown', 'Blind', 'Free play']);
    for (const mode of modes) {
      expect(modeLine(mode).split(' ').length).toBeLessThanOrEqual(7);
    }
  });

  it('describes Blind plainly: set an order, then watch', () => {
    expect(FORMAT_LINES.blind).toBe('Set your order, then watch.');
    expect(modeLine({ kind: 'series', format: 'blind' })).toBe('Set your order, then watch.');
  });

  it('names the bot’s level as a player reads it', () => {
    expect(BOT_LEVELS.map((bot) => levelLine(bot.id))).toStrictEqual([
      'vs Easy bot',
      'vs Normal bot',
      'vs Hard bot',
    ]);
  });

  it('heads the lineup with what is being set up, since the rules step is skipped', () => {
    expect(FORMATS.map(setupLine)).toStrictEqual([
      'Best of 3 · Blind',
      'Best of 3 · Reveal',
      'Best of 3 · Showdown',
    ]);
  });
});
