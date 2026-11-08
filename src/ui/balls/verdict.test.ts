import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../../sim/balls/index.ts';
import { COUNTER_MAP } from '../../sim/counter-map.ts';
import { verdictOf } from './verdict.ts';

const nameOf = (id: string) => BALL_LOOKUP.get(id)?.name ?? id;

// Read from the map rather than naming a pair, so the test holds through a rebalance.
const favouredPair = COUNTER_MAP.find((entry) => entry.intended !== 'even');
const evenPair = COUNTER_MAP.find((entry) => entry.intended === 'even');

describe('verdictOf', () => {
  it('names the favoured ball and the reason, whichever slot it is in', () => {
    if (favouredPair === undefined) throw new Error('expected a favoured pair');
    const { x, y, intended, reason } = favouredPair;
    const winner = intended === 'x' ? x : y;
    const asX = verdictOf(x, y, nameOf);
    expect(asX).toStrictEqual({
      headline: `${nameOf(winner)} is favoured`,
      reason,
      leanOfA: winner === x ? 'favoured' : 'unfavoured',
    });
    const asY = verdictOf(y, x, nameOf);
    expect(asY.headline).toBe(asX.headline);
    expect(asY.reason).toBe(reason);
    expect(asY.leanOfA).toBe(winner === y ? 'favoured' : 'unfavoured');
    expect(reason).not.toBe('');
  });

  it('calls an even pair even, with its reason, and a mirror a mirror', () => {
    if (evenPair === undefined) throw new Error('expected an even pair');
    const verdict = verdictOf(evenPair.x, evenPair.y, nameOf);
    expect(verdict).toMatchObject({ headline: 'Even matchup', leanOfA: 'even' });
    expect(verdict.reason).toBe(evenPair.reason);
    expect(verdict.reason).not.toBe('');
    expect(verdictOf('frost', 'frost', nameOf).headline).toBe('Mirror match');
  });
});
