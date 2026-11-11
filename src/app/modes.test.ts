import { describe, expect, it } from 'vitest';
import { FORMATS } from '../sim/series.ts';
import {
  botChooses,
  lineupParentOf,
  MAIN_FORMAT,
  OTHER_MODE_SECTIONS,
  writeMainModeParams,
} from './modes.ts';
import { parseRoute } from './route.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';

const modes = OTHER_MODE_SECTIONS.flatMap((section) => section.modes);

describe('the main mode (ADR 0046)', () => {
  it('is Reveal: home’s one tap opens its lineup, with no rules step', () => {
    expect(MAIN_FORMAT).toBe('reveal');
    const params = new URLSearchParams('view=manual&ball=storm');
    writeMainModeParams(params);
    expect(params.toString()).toBe('mode=bo3&fmt=reveal&step=lineup');
    expect(parseRoute(params, BALL_LOOKUP)).toMatchObject({
      screen: 'series',
      step: 'lineup',
      link: { format: 'reveal' },
    });
  });

  it('goes back to home from Reveal’s lineup, and to Other modes from any other format’s', () => {
    expect(lineupParentOf('reveal')).toBe('home');
    expect(lineupParentOf('showdown')).toBe('modes');
    expect(lineupParentOf('blind')).toBe('modes');
  });
});

describe('Other modes', () => {
  it('offers every other way to play exactly once: each format but the main, and Free play', () => {
    const formats = modes.flatMap((mode) => (mode.kind === 'series' ? [mode.format] : []));
    expect(new Set(formats).size).toBe(formats.length);
    expect([...formats].sort()).toStrictEqual(FORMATS.filter((f) => f !== MAIN_FORMAT).sort());
    expect(modes.filter((mode) => mode.kind === 'free')).toHaveLength(1);
  });

  it('leads with the format that keeps skill, and keeps Blind as the casual one', () => {
    expect(modes.map((mode) => (mode.kind === 'series' ? mode.format : mode.kind))).toStrictEqual([
      'showdown',
      'blind',
      'free',
    ]);
  });

  it('groups modes in titled sections, so a Best of 5 is one more section', () => {
    expect(OTHER_MODE_SECTIONS.map((section) => section.title)).toStrictEqual([
      'Best of 3 vs bot',
      'One match',
    ]);
    for (const section of OTHER_MODE_SECTIONS) expect(section.modes.length).toBeGreaterThan(0);
  });

  it('shows the bot’s level only where the bot makes choices', () => {
    expect(botChooses('reveal')).toBe(true);
    expect(botChooses('showdown')).toBe(true);
    expect(botChooses('blind')).toBe(false);
  });
});
