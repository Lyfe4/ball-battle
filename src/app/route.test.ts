import { RULESET_VERSION } from '../sim/ruleset.ts';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { randomBot } from '../sim/bot.ts';
import { setupWithPicks, type SeriesSetup } from '../sim/series.ts';
import { playSeries } from '../sim/series-verify.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import { writeSeriesParams } from './series-url.ts';
import {
  clearView,
  parseRoute,
  writeHomeParams,
  writeManualParams,
  writeMatchUrl,
  writePickParams,
  writeTodaysRuleset,
} from './route.ts';

const route = (query: string) => parseRoute(new URLSearchParams(query), BALL_LOOKUP);

describe('parseRoute', () => {
  it('opens every link shape the game writes on the screen it was written from', () => {
    const v = `v=${String(RULESET_VERSION)}`;
    expect(route(`a=storm&b=frost&seed=42&${v}`)).toStrictEqual({
      screen: 'match',
      matchup: { a: 'storm', b: 'frost' },
      seed: 42,
    });
    // A blind series against the bot, as the game writes it once decided.
    const bot = randomBot.pickLineup(9, [...BALL_LOOKUP.keys()]);
    const lb = bot.join(',');
    expect(route(`mode=bo3&la=storm,frost,venom&lb=${lb}&seed=9&${v}`)).toStrictEqual({
      screen: 'series',
      link: {
        setup: {
          ruleset: RULESET_VERSION,
          seed: 9,
          a: ['storm', 'frost', 'venom'],
          b: bot,
          opponent: { kind: 'bot', bot: 'random', lineupSeed: 9 },
        },
      },
      step: 'play',
    });
    expect(route('mode=bo3&fmt=reveal')).toStrictEqual({
      screen: 'series',
      link: { format: 'reveal' },
      step: 'rules',
    });
    expect(route('mode=bo3')).toStrictEqual({ screen: 'series', link: {}, step: 'rules' });
    expect(route('mode=bo3&la=storm,frost,venom')).toMatchObject({ step: 'lineup' });
    expect(route('mode=bo3&fmt=loser&step=lineup')).toMatchObject({ step: 'lineup' });
  });

  it('holds a replay link from another ruleset on the outdated screen (ADR 0022)', () => {
    // Every replay link written before versions: unversioned, so made under ruleset 0.
    expect(route('a=storm&b=frost&seed=42')).toStrictEqual({
      screen: 'outdated',
      kind: 'match',
      made: 0,
    });
    expect(route('mode=bo3&la=storm,frost,venom&lb=quake,thorns,archer&seed=9')).toStrictEqual({
      screen: 'outdated',
      kind: 'series',
      made: 0,
    });
    expect(
      route('mode=bo3&fmt=loser&la=storm,frost,venom&lb=quake,thorns,archer&seed=9&picks=thorns'),
    ).toMatchObject({ screen: 'outdated', kind: 'series' });
    // From a newer page than this one, or with a version that isn't a number.
    const newer = RULESET_VERSION + 1;
    expect(route(`seed=4&v=${String(newer)}`)).toStrictEqual({
      screen: 'outdated',
      kind: 'match',
      made: newer,
    });
    expect(route('a=storm&b=frost&seed=42&v=latest')).toMatchObject({ made: 0 });
  });

  it('plays an outdated link under today’s rules once asked to, and nothing else changes', () => {
    const match = new URLSearchParams('a=storm&b=frost&seed=42');
    writeTodaysRuleset(match);
    expect(parseRoute(match, BALL_LOOKUP)).toStrictEqual({
      screen: 'match',
      matchup: { a: 'storm', b: 'frost' },
      seed: 42,
    });
    // An old series the rules now refuse (this bot never picked that lineup) opens its lineup.
    const series = new URLSearchParams(
      'mode=bo3&fmt=loser&la=storm,frost,venom&lb=quake,thorns,archer&seed=9&picks=thorns',
    );
    writeTodaysRuleset(series);
    expect(parseRoute(series, BALL_LOOKUP)).toStrictEqual({
      screen: 'series',
      link: { lineup: ['storm', 'frost', 'venom'], format: 'loser' },
      step: 'lineup',
    });
  });

  it('opens a match without a seed when the link has none or a bad one, so a fresh one is used', () => {
    expect(route('a=storm&b=frost')).toMatchObject({ screen: 'match', seed: undefined });
    expect(route('a=storm&b=frost&seed=-1')).toMatchObject({ screen: 'match', seed: undefined });
  });

  it('falls back instead of failing on a typo', () => {
    expect(route('a=nope&b=FROST')).toMatchObject({ matchup: { a: 'speedster', b: 'frost' } });
    expect(route('mode=bo3&la=storm,storm,frost')).toStrictEqual({
      screen: 'series',
      link: {},
      step: 'rules',
    });
  });

  it('opens home on a bare URL, and a match as soon as the link names a ball or a seed', () => {
    expect(route('')).toStrictEqual({ screen: 'home' });
    expect(route('utm_source=x')).toStrictEqual({ screen: 'home' });
    expect(route('a=storm')).toMatchObject({ screen: 'match', matchup: { a: 'storm' } });
    expect(route(`seed=4&v=${String(RULESET_VERSION)}`)).toMatchObject({
      screen: 'match',
      seed: 4,
    });
  });

  it('writes a match over any other screen, and home as a bare URL', () => {
    const params = new URLSearchParams('view=pick&mode=bo3&step=lineup&fmt=loser');
    writeMatchUrl(params, { a: 'venom', b: 'quake' }, 12);
    expect(params.toString()).toBe(`a=venom&b=quake&seed=12&v=${String(RULESET_VERSION)}`);
    writeHomeParams(params);
    expect(parseRoute(params, BALL_LOOKUP)).toStrictEqual({ screen: 'home' });
  });

  it('opens the quick-match setup prefilled, and round-trips it', () => {
    expect(route('view=pick&a=storm&b=vampire')).toStrictEqual({
      screen: 'pick',
      matchup: { a: 'storm', b: 'vampire' },
    });
    const params = new URLSearchParams('mode=bo3&seed=4&fmt=loser');
    writePickParams(params, { a: 'frost', b: 'quake' });
    expect(params.toString()).toBe('view=pick&a=frost&b=quake');
    expect(parseRoute(params, BALL_LOOKUP)).toStrictEqual({
      screen: 'pick',
      matchup: { a: 'frost', b: 'quake' },
    });
    clearView(params);
    expect(parseRoute(params, BALL_LOOKUP)).toMatchObject({
      screen: 'match',
      matchup: { a: 'frost' },
    });
  });

  it('opens the manual on the roster, a ball, or the chart, and ignores an unknown ball', () => {
    expect(route('view=manual')).toStrictEqual({ screen: 'manual', ball: undefined, chart: false });
    expect(route('view=manual&ball=Storm')).toMatchObject({ ball: 'storm', chart: false });
    expect(route('view=manual&ball=nope')).toMatchObject({ ball: undefined });
    expect(route('view=manual&tab=chart')).toMatchObject({ ball: undefined, chart: true });
    const params = new URLSearchParams('a=storm&b=frost&seed=3');
    writeManualParams(params, { ball: 'venom' });
    expect(params.toString()).toBe('view=manual&ball=venom');
    writeManualParams(params, { chart: true });
    expect(params.toString()).toBe('view=manual&tab=chart');
  });

  describe('a series link agrees with playSeries (one rule, ADR 0022)', () => {
    const ids = [...BALL_LOOKUP.keys()];
    const base: SeriesSetup = {
      ruleset: RULESET_VERSION,
      seed: 21,
      a: randomBot.pickLineup(5, ids),
      b: randomBot.pickLineup(21, ids),
      opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: 21 },
      format: 'reveal',
    };
    const played = setupWithPicks(playLikeTheGame(base, BALL_LOOKUP));
    const picks = played.picks ?? [];
    const notTheirs = ids.find((id) => !played.a.includes(id) && played.b.includes(id)) ?? '';
    const [x, y, z] = played.b;
    const linkOf = (setup: SeriesSetup) => {
      const params = new URLSearchParams();
      writeSeriesParams(params, setup);
      return parseRoute(params, BALL_LOOKUP);
    };
    const plays = (setup: SeriesSetup) => {
      try {
        playSeries(setup, BALL_LOOKUP);
        return true;
      } catch {
        return false;
      }
    };

    it.each<[string, SeriesSetup]>([
      ['the link the game wrote', played],
      ['the bot lineup edited', { ...played, b: [y, x, z] }],
      [
        'the bot’s first pick edited',
        { ...played, picks: [notTheirs === x ? y : x, ...picks.slice(1)] },
      ],
      [
        'the player answering with a ball of the bot’s',
        { ...played, picks: [picks[0] ?? '', notTheirs, ...picks.slice(2)] },
      ],
      ['a pick missing', { ...played, picks: picks.slice(0, 3) }],
    ])('%s', (_name, setup) => {
      const route = linkOf(setup);
      const replays = route.screen === 'series' && route.step === 'play';
      expect(replays).toBe(plays(setup));
      if (!replays) {
        // Not replayed: the lineup step, prefilled with the player's lineup and the format.
        expect(route).toStrictEqual({
          screen: 'series',
          link: { lineup: setup.a, format: 'reveal' },
          step: 'lineup',
        });
      }
    });
  });
});
