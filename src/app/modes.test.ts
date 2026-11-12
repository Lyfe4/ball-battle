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

  it('goes back to Other modes from every Best of 5 lineup, Reveal’s included (ADR 0048)', () => {
    for (const format of FORMATS) expect(lineupParentOf(format, 5)).toBe('modes');
    expect(lineupParentOf('reveal', 3)).toBe('home');
  });
});

describe('Other modes', () => {
  it('offers every format once, under a length choice, and Free play once (ADR 0048)', () => {
    // At Best of 5 nothing else reaches Reveal, so the series section lists every format.
    const series = OTHER_MODE_SECTIONS.filter((section) => section.lengthChoice === true);
    expect(series).toHaveLength(1);
    const formats = (series[0]?.modes ?? []).flatMap((mode) =>
      mode.kind === 'series' ? [mode.format] : [],
    );
    expect([...formats].sort()).toStrictEqual([...FORMATS].sort());
    expect(modes.filter((mode) => mode.kind === 'free')).toHaveLength(1);
    // Free play is one match: no length to choose.
    for (const section of OTHER_MODE_SECTIONS) {
      if (section.modes.some((mode) => mode.kind === 'free')) {
        expect(section.lengthChoice).toBeUndefined();
      }
    }
  });

  it('orders the series by skill: the main format, then Showdown, then Blind as the casual one', () => {
    expect(modes.map((mode) => (mode.kind === 'series' ? mode.format : mode.kind))).toStrictEqual([
      MAIN_FORMAT,
      'showdown',
      'blind',
      'free',
    ]);
  });

  it('groups modes in titled sections', () => {
    expect(OTHER_MODE_SECTIONS.map((section) => section.title)).toStrictEqual([
      'Series vs bot',
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
