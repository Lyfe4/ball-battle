import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { botPick, randomBot } from './bot.ts';
import { COUNTER_MAP, isFavoured } from './counter-map.ts';
import {
  awaitingPick,
  nextBallOf,
  nextMatch,
  outcomeOf,
  playSeries,
  playToEnd,
  matchWorld,
  recordOutcome,
  recordPick,
  remainingOf,
  setupWithPicks,
  startSeries,
  type Outcome,
  type SeriesSetup,
  type SeriesState,
} from './series.ts';
import { deepFreeze } from './test-support.ts';

const loser: SeriesSetup = deepFreeze({
  seed: 7,
  a: ['speedster', 'vampire', 'archer'],
  b: ['storm', 'frost', 'quake'],
  format: 'loser',
});

const feed = (outcomes: readonly Outcome[], from: SeriesState = startSeries(loser)) =>
  outcomes.reduce(recordOutcome, from);

describe('loser picks next', () => {
  it('stops after round 1 for the loser to pick, with the winner keeping its order', () => {
    const afterOne = feed(['a']);
    expect(awaitingPick(afterOne)).toBe('b');
    expect(nextMatch(afterOne)).toBeUndefined();
    // The winner's next ball is fixed by its order, so the loser sees it before picking.
    expect(nextBallOf(afterOne, 'a')).toBe('vampire');
    expect(remainingOf(afterOne, 'b')).toStrictEqual(['frost', 'quake']);

    const picked = recordPick(afterOne, 'quake');
    expect(awaitingPick(picked)).toBeUndefined();
    expect(nextMatch(picked)).toMatchObject({ round: 1, a: 'vampire', b: 'quake' });
    expect(picked.picks).toStrictEqual([{ round: 1, side: 'b', ball: 'quake' }]);

    // 1-1: each side has one ball left, so there is nothing to pick and round 3 follows.
    const oneAll = recordOutcome(picked, 'b');
    expect(awaitingPick(oneAll)).toBeUndefined();
    expect(nextMatch(oneAll)).toMatchObject({ round: 2, a: 'archer', b: 'frost' });
  });

  it('lets the player pick when the player loses', () => {
    const afterOne = feed(['b']);
    expect(awaitingPick(afterOne)).toBe('a');
    expect(nextMatch(recordPick(afterOne, 'archer'))).toMatchObject({ a: 'archer', b: 'frost' });
  });

  it('plays no round before the pick, and asks for none while a drawn round is replayed', () => {
    expect(() => feed(['a', 'b'])).toThrow(/pick is due/);
    expect(() => recordPick(startSeries(loser), 'storm')).toThrow(/No pick is due/);
    const replaying = recordOutcome(recordPick(feed(['a']), 'frost'), 'draw');
    expect(awaitingPick(replaying)).toBeUndefined();
    expect(nextMatch(replaying)).toMatchObject({ round: 1, attempt: 1, b: 'frost' });
  });

  it('rejects a pick of a ball the side has already played or never had', () => {
    const afterOne = feed(['a']);
    expect(() => recordPick(afterOne, 'storm')).toThrow(/has left/);
    expect(() => recordPick(afterOne, 'brawler')).toThrow(/has left/);
    expect(() => recordPick(recordPick(afterOne, 'frost'), 'quake')).toThrow(/No pick is due/);
  });

  it('replays the same series from its setup and picks, and refuses missing or unused picks', () => {
    // Play it as the browser does, with the bot picking when it loses and the player picking the
    // last ball in its order when it does.
    let state = startSeries(loser);
    for (;;) {
      const due = awaitingPick(state);
      if (due !== undefined) {
        const pick = botPick(randomBot, state) ?? remainingOf(state, 'a').at(-1);
        if (pick === undefined) throw new Error('expected a pick');
        state = recordPick(state, pick);
        continue;
      }
      const match = nextMatch(state);
      if (match === undefined) break;
      const end = playToEnd(matchWorld(match, BALL_LOOKUP), BALL_LOOKUP);
      if (end.match.status !== 'finished') throw new Error('unfinished');
      state = recordOutcome(state, outcomeOf(end.match.result, end));
    }
    const replayed = playSeries(setupWithPicks(state), BALL_LOOKUP);
    expect(replayed.rounds).toStrictEqual(state.rounds);
    expect(replayed.picks).toStrictEqual(state.picks);
    expect(playSeries(setupWithPicks(state), BALL_LOOKUP)).toStrictEqual(replayed);

    if (state.picks.length > 0) {
      expect(() => playSeries({ ...loser, picks: [] }, BALL_LOOKUP)).toThrow(/needs a pick/);
    }
    const extra = [...(setupWithPicks(state).picks ?? []), 'archer', 'archer'];
    expect(() => playSeries({ ...loser, picks: extra }, BALL_LOOKUP)).toThrow(/pick/);
  });
});

describe('reveal, then order', () => {
  it('plays exactly like a blind series with the same orders', () => {
    const blind: SeriesSetup = {
      seed: 11,
      a: ['frost', 'thorns', 'sniper'],
      b: ['venom', 'quake', 'brawler'],
    };
    const reveal = playSeries({ ...blind, format: 'reveal' }, BALL_LOOKUP);
    expect(reveal.rounds).toStrictEqual(playSeries(blind, BALL_LOOKUP).rounds);
    expect(reveal.picks).toStrictEqual([]);
    expect(awaitingPick(feed(['a'], startSeries({ ...blind, format: 'reveal' })))).toBeUndefined();
  });
});

describe('the bot', () => {
  const ids = BALLS.map((ball) => ball.id);

  it('orders its own lineup at random but deterministically', () => {
    const own = randomBot.pickLineup(3, ids);
    const orders = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const order = randomBot.orderLineup(seed, own, ['brawler', 'storm', 'frost']);
      expect([...order].sort()).toStrictEqual([...own].sort());
      expect(randomBot.orderLineup(seed, own, ['brawler', 'storm', 'frost'])).toStrictEqual(order);
      orders.add(order.join());
    }
    expect(orders.size).toBe(6);
  });

  it('picks a counter to the winner’s next ball whenever the counter map has one', () => {
    let checked = 0;
    for (const opponent of ids) {
      const counters = ids.filter((id) => isFavoured(id, opponent));
      const others = ids.filter((id) => id !== opponent && !isFavoured(id, opponent));
      for (const counter of counters) {
        for (const other of others.slice(0, 3)) {
          for (let seed = 0; seed < 5; seed++) {
            expect(randomBot.pickNext(seed, 1, [other, counter], opponent)).toBe(counter);
            expect(randomBot.pickNext(seed, 1, [counter, other], opponent)).toBe(counter);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('picks at random among its balls when none counters, and never outside them', () => {
    // The Brawler is even against everyone but Thorns: nothing in this pair counters it.
    const remaining = ['storm', 'sniper'];
    expect(remaining.some((id) => isFavoured(id, 'brawler'))).toBe(false);
    const picks = new Set(
      Array.from({ length: 40 }, (_, seed) => randomBot.pickNext(seed, 1, remaining, 'brawler')),
    );
    expect(picks).toStrictEqual(new Set(remaining));
    expect(randomBot.pickNext(9, 1, remaining, 'brawler')).toBe(
      randomBot.pickNext(9, 1, remaining, 'brawler'),
    );
  });

  it('knows the map: every favoured entry reads as a counter one way only', () => {
    for (const entry of COUNTER_MAP) {
      const xWins = isFavoured(entry.x, entry.y);
      const yWins = isFavoured(entry.y, entry.x);
      expect(xWins).toBe(entry.intended === 'x');
      expect(yWins).toBe(entry.intended === 'y');
    }
  });

  it('picks for side B only when the bot is the one due to pick', () => {
    // The bot lost round 1; it faces the Vampire next with the Frost and the Quake left.
    const afterOne = feed(['a']);
    const pick = botPick(randomBot, afterOne);
    const expected = ['frost', 'quake'].filter((id) => isFavoured(id, 'vampire'));
    if (expected.length > 0) expect(expected).toContain(pick);
    else expect(['frost', 'quake']).toContain(pick);
    expect(botPick(randomBot, feed(['b']))).toBeUndefined();
    expect(botPick(randomBot, startSeries(loser))).toBeUndefined();
  });
});
