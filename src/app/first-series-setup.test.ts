import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { FIRST_SERIES, STARTER_TRIO, starterTrio } from './first-series-setup.ts';

describe('the first series (ADR 0090)', () => {
  it('plays Best of 3 · Reveal against the Easy bot', () => {
    expect(FIRST_SERIES).toStrictEqual({ format: 'reveal', bestOf: 3, level: 'easy' });
  });
});

describe('Pick for me (ADR 0090)', () => {
  it('names balls of this build, by id', () => {
    const ids = BALLS.map((ball) => ball.id);
    for (const id of STARTER_TRIO) expect(ids).toContain(id);
    expect(starterTrio(ids)).toStrictEqual(STARTER_TRIO);
  });

  it('fills from the roster when a starter is missing, whatever its order', () => {
    expect(starterTrio(['venom', 'titan', 'slime', 'archer'])).toStrictEqual([
      'archer',
      'venom',
      'titan',
    ]);
    expect(starterTrio(['slime', 'titan', 'sniper'])).toStrictEqual(['slime', 'titan', 'sniper']);
  });
});
