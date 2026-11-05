import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../../sim/balls/index.ts';
import { verdictOf } from './verdict.ts';

const nameOf = (id: string) => BALL_LOOKUP.get(id)?.name ?? id;

describe('verdictOf', () => {
  it('names the favoured ball and the reason, whichever slot it is in', () => {
    const asA = verdictOf('storm', 'vampire', nameOf);
    expect(asA).toStrictEqual({
      headline: 'Storm is favoured',
      reason: 'Lightning is ranged damage, which lifesteal cannot answer.',
      leanOfA: 'favoured',
    });
    const asB = verdictOf('vampire', 'storm', nameOf);
    expect(asB.headline).toBe('Storm is favoured');
    expect(asB.reason).toBe(asA.reason);
    expect(asB.leanOfA).toBe('unfavoured');
  });

  it('calls an even pair even, with its reason, and a mirror a mirror', () => {
    expect(verdictOf('archer', 'storm', nameOf)).toMatchObject({
      headline: 'Even matchup',
      leanOfA: 'even',
    });
    expect(verdictOf('archer', 'storm', nameOf).reason).not.toBe('');
    expect(verdictOf('frost', 'frost', nameOf).headline).toBe('Mirror match');
  });
});
