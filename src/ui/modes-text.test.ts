import { describe, expect, it } from 'vitest';
import { BOT_LEVELS } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { BEST_OF, FORMATS, recordOutcome, startSeries, type Outcome } from '../sim/series.ts';
import {
  FRIEND_SETUP_NOTE,
  lengthChoiceOf,
  levelLine,
  OPPONENT_CARDS,
  PLAY_LABEL,
  playLine,
  playSpoken,
  RESUME_PLAY,
  resumeLine,
  resumeSpoken,
  setupLine,
} from './modes-text.ts';
import { FORMAT_LINES } from './series-text.ts';

describe('the words for the ways to play (ADR 0046, 0055)', () => {
  it('says what home’s Play starts, in words, not only “Play”', () => {
    expect(PLAY_LABEL).toBe('Play');
    expect(playLine({ format: 'reveal', bestOf: 3, level: 'normal' })).toBe(
      'Best of 3 · Reveal · vs Normal bot',
    );
    expect(playLine({ format: 'reveal', bestOf: 5, level: 'hard' })).toBe(
      'Best of 5 · Reveal · vs Hard bot',
    );
    expect(playSpoken({ format: 'showdown', bestOf: 5, level: 'easy' })).toBe(
      'Play Best of 5, Showdown, against the Easy bot',
    );
  });

  it('names no level for Blind, where the bot makes no choices', () => {
    expect(playLine({ format: 'blind', bestOf: 3, level: 'hard' })).toBe(
      'Best of 3 · Blind · vs bot',
    );
    expect(playSpoken({ format: 'blind', bestOf: 3, level: 'hard' })).toBe(
      'Play Best of 3, Blind, against the bot',
    );
  });

  it('names each opponent card by its title alone: the title says who it plays', () => {
    expect(OPPONENT_CARDS).toEqual({ bot: { name: 'vs Bot' }, friend: { name: 'vs Friend' } });
  });

  it('says what a live friend match asks before the lineup', () => {
    expect(FRIEND_SETUP_NOTE).toBe(
      'Live: you both stay until the end, 30 s a pick. You send a link; the match starts when they accept.',
    );
  });

  it('describes Blind plainly: set an order, then watch', () => {
    expect(FORMAT_LINES.blind).toBe('Set your order, then watch.');
  });

  it('names the bot’s level as a player reads it', () => {
    expect(BOT_LEVELS.map((bot) => levelLine(bot.id))).toStrictEqual([
      'vs Easy bot',
      'vs Normal bot',
      'vs Hard bot',
    ]);
  });

  it('heads the lineup with what is being set up, since Play skips the setup', () => {
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
