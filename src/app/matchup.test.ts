import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { DEFAULT_MATCHUP, parseMatchup, writeMatchParams } from './matchup.ts';

const ids = BALLS.map((ball) => ball.id);

function parse(query: string) {
  return parseMatchup(new URLSearchParams(query), ids);
}

describe('parseMatchup', () => {
  it('defaults to two different, real balls', () => {
    expect(DEFAULT_MATCHUP.a).not.toBe(DEFAULT_MATCHUP.b);
    expect(ids).toContain(DEFAULT_MATCHUP.a);
    expect(ids).toContain(DEFAULT_MATCHUP.b);
    expect(parse('')).toStrictEqual(DEFAULT_MATCHUP);
  });

  it('reads a valid matchup', () => {
    expect(parse('a=brawler&b=speedster&seed=42')).toStrictEqual({ a: 'brawler', b: 'speedster' });
  });

  it('allows mirror matches', () => {
    expect(parse('a=vampire&b=vampire')).toStrictEqual({ a: 'vampire', b: 'vampire' });
  });

  it('accepts different case and surrounding spaces', () => {
    expect(parse('a=%20Brawler%20&b=SPEEDSTER')).toStrictEqual({ a: 'brawler', b: 'speedster' });
  });

  it('falls back per slot for missing or unknown ids', () => {
    expect(parse('a=speedstr&b=brawler')).toStrictEqual({ a: DEFAULT_MATCHUP.a, b: 'brawler' });
    expect(parse('a=brawler')).toStrictEqual({ a: 'brawler', b: DEFAULT_MATCHUP.b });
    expect(parse('a=&b=<script>')).toStrictEqual(DEFAULT_MATCHUP);
  });

  it('uses the first value when a parameter repeats', () => {
    expect(parse('a=brawler&a=vampire')).toMatchObject({ a: 'brawler' });
  });
});

describe('writeMatchParams', () => {
  it('round-trips through parseMatchup and keeps other parameters', () => {
    const params = new URLSearchParams('debug=1&a=nope');
    writeMatchParams(params, { a: 'brawler', b: 'vampire' }, 42);
    expect(params.get('debug')).toBe('1');
    expect(params.get('seed')).toBe('42');
    expect(parseMatchup(params, ids)).toStrictEqual({ a: 'brawler', b: 'vampire' });
  });
});
