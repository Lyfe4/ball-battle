// The bots read the counter map's three levels (ADR 0073), and ruleset 19's bots are kept as they
// played, so its series still verify (the proof against its frozen bundle is
// scripts/replayed-rulesets.slow.test.ts).
import { describe, expect, it } from 'vitest';
import { mapOdds } from './bot-model.ts';
import { EVEN_IN_R19 } from './bot-r19.ts';
import { botFor, botNamed, hardBot, normalBot, NORMAL_COUNTER_SHARE, type BotView } from './bot.ts';
import { matchupOf, standingOf } from './counter-map.ts';
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
    expect(standingOf('vampire', 'speedster')).toBe(1);
    expect(standingOf('speedster', 'vampire')).toBe(-1);
    expect(standingOf('brawler', 'storm')).toBe(0);
    expect(standingOf('storm', 'storm')).toBe(0);
  });

  it('give Hard the middle of each band: 70 / 60 / 50 / 40 / 30%', () => {
    expect(mapOdds('frost', 'speedster')).toBe(0.7);
    expect(mapOdds('vampire', 'speedster')).toBe(0.6);
    expect(mapOdds('brawler', 'storm')).toBe(0.5);
    expect(mapOdds('speedster', 'vampire')).toBeCloseTo(0.4, 12);
    expect(mapOdds('speedster', 'frost')).toBeCloseTo(0.3, 12);
  });
});

describe('Normal, by level', () => {
  it('answers with a strong counter over an edge', () => {
    const weights = normalBot.weights(answering(['vampire', 'frost', 'brawler'], 'speedster'));
    expect(weightOf(weights, 'frost')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(3), 12);
    expect(weightOf(weights, 'vampire')).toBeCloseTo(random(3), 12);
  });

  it('answers with an edge over an even ball, and an even ball over one countered', () => {
    const weights = normalBot.weights(answering(['archer', 'brawler', 'vampire'], 'speedster'));
    expect(weightOf(weights, 'vampire')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(3), 12);
    const even = normalBot.weights(answering(['archer', 'brawler'], 'speedster'));
    expect(weightOf(even, 'brawler')).toBeCloseTo(NORMAL_COUNTER_SHARE + random(2), 12);
  });
});

describe('Hard, by level', () => {
  it('answers the last round with the ball whose level is best', () => {
    const last: BotView = {
      ...answering(['vampire', 'frost'], 'speedster'),
      round: 2,
      wins: 1,
      losses: 1,
    };
    expect(hardBot.weights(last)).toStrictEqual([['frost', 1]]);
  });
});

describe("ruleset 19's bots, kept", () => {
  it('are the bots of every older ruleset that replays here, and of no other', () => {
    expect(SAME_FIGHTS_AS).toStrictEqual([19]);
    expect(replaysHere(19)).toBe(true);
    expect(replaysHere(RULESET_VERSION)).toBe(true);
    expect(replaysHere(18)).toBe(false);
    for (const id of ['easy', 'normal', 'hard', 'random']) {
      expect(botNamed(id, 19), id).toBeDefined();
      expect(botNamed(id, RULESET_VERSION), id).toBeDefined();
    }
    expect(botNamed('easy', 19)).toBe(botNamed('easy'));
    expect(botNamed('normal', 19)).not.toBe(normalBot);
    expect(botFor({ kind: 'bot', bot: 'hard', lineupSeed: 1 }, 19)).not.toBe(hardBot);
  });

  it('read the 49 pairs that became edges as even, as ruleset 19 did', () => {
    expect(EVEN_IN_R19).toHaveLength(49);
    for (const [favoured, other] of EVEN_IN_R19) {
      expect(matchupOf(favoured, other), `${favoured} vs ${other}`).toStrictEqual({
        favoured,
        level: 'edge',
      });
    }
    // Answering the Speedster, ruleset 19's Normal saw the Vampire as even with the Brawler.
    const view = answering(['vampire', 'brawler', 'archer'], 'speedster');
    const old = botNamed('normal', 19)?.weights(view) ?? [];
    const share = NORMAL_COUNTER_SHARE / 2 + random(3);
    expect(weightOf(old, 'vampire')).toBeCloseTo(share, 12);
    expect(weightOf(old, 'brawler')).toBeCloseTo(share, 12);
  });
});
