// The bots read the counter map's three levels (ADR 0073). Ruleset 21 changed fights (ADR 0074), so
// no older ruleset replays here and no older bots are kept.
import { describe, expect, it } from 'vitest';
import { mapOdds } from './bot-model.ts';
import { botFor, botNamed, hardBot, normalBot, NORMAL_COUNTER_SHARE, type BotView } from './bot.ts';
import { standingOf } from './counter-map.ts';
import { RULESET_VERSION, replaysHere, SAME_FIGHTS_AS } from './ruleset.ts';

const answering = (own: readonly string[], shown: string): BotView => ({
  format: 'reveal',
  seed: 3,
  round: 1,
  role: 'answer',
  own,
  opponent: [shown, 'brawler'],
  shown,
  wins: 0,
  losses: 1,
});

const weightOf = (weights: readonly (readonly [string, number])[], ball: string) =>
  weights.find(([id]) => id === ball)?.[1] ?? 0;

const random = (count: number) => (1 - NORMAL_COUNTER_SHARE) / count;

describe('the levels the bots read', () => {
  it('stand 2 for a strong counter, 1 for an edge, 0 even, and the same from the other side', () => {
    expect(standingOf('frost', 'speedster')).toBe(2);
    expect(standingOf('speedster', 'frost')).toBe(-2);
    expect(standingOf('venom', 'speedster')).toBe(1);
    expect(standingOf('speedster', 'venom')).toBe(-1);
    expect(standingOf('brawler', 'storm')).toBe(0);
    expect(standingOf('storm', 'storm')).toBe(0);
  });

  it('give Hard the middle of each band: 70 / 60 / 50 / 40 / 30%', () => {
    expect(mapOdds('frost', 'speedster')).toBe(0.7);
    expect(mapOdds('venom', 'speedster')).toBe(0.6);
    expect(mapOdds('brawler', 'storm')).toBe(0.5);
    expect(mapOdds('speedster', 'venom')).toBeCloseTo(0.4, 12);
    expect(mapOdds('speedster', 'frost')).toBeCloseTo(0.3, 12);
  });
});

describe('Normal, by level', () => {
  it('answers with a strong counter over an edge', () => {
    const weights = normalBot.weights(answering(['venom', 'frost', 'brawler'], 'speedster'));
    expect(weightOf(weights, 'frost')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(3), 12);
    expect(weightOf(weights, 'venom')).toBeCloseTo(random(3), 12);
  });

  it('answers with an edge over an even ball, and an even ball over one countered', () => {
    const weights = normalBot.weights(answering(['archer', 'brawler', 'venom'], 'speedster'));
    expect(weightOf(weights, 'venom')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(3), 12);
    const even = normalBot.weights(answering(['archer', 'brawler'], 'speedster'));
    expect(weightOf(even, 'brawler')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(2), 12);
  });
});

describe('Hard, by level', () => {
  it('answers the last round with the ball whose level is best', () => {
    const last: BotView = {
      ...answering(['venom', 'frost'], 'speedster'),
      round: 2,
      wins: 1,
      losses: 1,
    };
    expect(hardBot.weights(last)).toStrictEqual([['frost', 1]]);
  });
});

describe('older rulesets', () => {
  it('replay here only when their fights are today’s: none since ruleset 21 (ADR 0074)', () => {
    expect(SAME_FIGHTS_AS).toStrictEqual([]);
    expect(replaysHere(RULESET_VERSION)).toBe(true);
    expect(replaysHere(20)).toBe(false);
    expect(replaysHere(19)).toBe(false);
    for (const id of ['easy', 'normal', 'hard', 'random']) {
      expect(botNamed(id, 20), id).toBe(botNamed(id));
    }
    expect(botFor({ kind: 'bot', bot: 'hard', lineupSeed: 1 }, 19)).toBe(hardBot);
  });
});
