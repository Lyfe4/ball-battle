import { describe, expect, it } from 'vitest';
import { OTHER_MODE_SECTIONS } from '../app/modes.ts';
import { BOT_LEVELS } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { BEST_OF, FORMATS, recordOutcome, startSeries, type Outcome } from '../sim/series.ts';
import {
  lengthChoiceOf,
  levelLine,
  MAIN_PLAY,
  modeLine,
  modeName,
  RESUME_PLAY,
  resumeLine,
  resumeSpoken,
  setupLine,
} from './modes-text.ts';
import { FORMAT_LINES } from './series-text.ts';

const modes = OTHER_MODE_SECTIONS.flatMap((section) => section.modes);

describe('the words for the ways to play (ADR 0046)', () => {
  it('says what home’s one tap plays, in words, not only “Play”', () => {
    expect(MAIN_PLAY.label).toBe('Play');
    expect(MAIN_PLAY.meta).toBe('Best of 3 · Reveal · vs bot');
    expect(MAIN_PLAY.spoken).toBe('Play Best of 3, Reveal, against the bot');
  });

  it('names every other mode and says how it plays in a few words', () => {
    expect(modes.map(modeName)).toStrictEqual(['Reveal', 'Showdown', 'Blind', 'Free play']);
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
    expect(FORMATS.map((format) => setupLine(format))).toStrictEqual([
      'Best of 3 · Blind',
      'Best of 3 · Reveal',
      'Best of 3 · Showdown',
    ]);
    expect(setupLine('reveal', 5)).toBe('Best of 5 · Reveal');
  });

  it('names each series length and the rule it plays by (ADR 0048)', () => {
    expect(BEST_OF.map(lengthChoiceOf)).toStrictEqual([
      { name: 'Best of 3', rule: '3 balls each · first to 2 wins' },
      { name: 'Best of 5', rule: '5 balls each · first to 3 wins' },
    ]);
  });
});

describe('home’s Resume series (ADR 0046)', () => {
  const blind = startSeries({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'bot', bot: 'normal', lineupSeed: 1 },
    seed: 1,
    a: ['speedster', 'vampire', 'archer'],
    b: ['storm', 'frost', 'quake'],
  });
  const reveal = startSeries({ ...blind.setup, format: 'reveal' });
  const after = (outcomes: readonly Outcome[]) => outcomes.reduce(recordOutcome, blind);

  it('says what is held: the format and the score, the player first', () => {
    expect(RESUME_PLAY.label).toBe('Resume series');
    expect(resumeLine(after(['a']))).toBe('Best of 3 · Blind · You 1–0 Bot');
    expect(resumeLine(after(['b', 'draw']))).toBe('Best of 3 · Blind · You 0–1 Bot');
    expect(resumeLine(reveal)).toBe('Best of 3 · Reveal · You 0–0 Bot');
  });

  it('says it all in words to a screen reader', () => {
    expect(resumeSpoken(after(['a']))).toBe('Resume series: Best of 3, Blind, you 1, bot 0');
  });
});
