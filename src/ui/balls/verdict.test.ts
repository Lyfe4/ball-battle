import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../../sim/balls/index.ts';
import { COUNTER_MAP } from '../../sim/counter-map.ts';
import { verdictOf } from './verdict.ts';

const nameOf = (id: string) => BALL_LOOKUP.get(id)?.name ?? id;

// Read from the map rather than naming a pair, so the test holds through a rebalance.
const evenPair = COUNTER_MAP.find((entry) => entry.intended === 'even');

describe('verdictOf', () => {
  it.each(['strong', 'edge'] as const)(
    'names the favoured ball, its level, its odds and the reason, whichever slot it is in (%s)',
    (level) => {
      const pair = COUNTER_MAP.find((entry) => entry.intended !== 'even' && entry.level === level);
      if (pair === undefined || pair.intended === 'even') throw new Error(`expected a ${level}`);
      const { x, y, intended, reason } = pair;
      const winner = intended === 'x' ? x : y;
      const [how, odds] = level === 'strong' ? ['strongly', '7'] : ['slightly', '6'];
      const asX = verdictOf(x, y, nameOf);
      expect(asX).toStrictEqual({
        headline: `${nameOf(winner)} is ${how} favoured`,
        reason: `Wins about ${odds} in 10. ${reason}`,
        leanOfA: winner === x ? 'favoured' : 'unfavoured',
      });
      const asY = verdictOf(y, x, nameOf);
      expect(asY.headline).toBe(asX.headline);
      expect(asY.reason).toBe(asX.reason);
      expect(asY.leanOfA).toBe(winner === y ? 'favoured' : 'unfavoured');
      expect(reason).not.toBe('');
    },
  );

  it('calls an even pair even, with its reason, and a mirror a mirror', () => {
    if (evenPair === undefined) throw new Error('expected an even pair');
    const verdict = verdictOf(evenPair.x, evenPair.y, nameOf);
    expect(verdict).toMatchObject({ headline: 'Even matchup', leanOfA: 'even' });
    expect(verdict.reason).toBe(evenPair.reason);
    expect(verdict.reason).not.toBe('');
    expect(verdictOf('frost', 'frost', nameOf).headline).toBe('Mirror match');
  });
});
