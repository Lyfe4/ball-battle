import { describe, expect, it } from 'vitest';
import { DEFAULT_SEEDS, parseBalanceArgs } from './balance-args.ts';

const ids = ['brawler', 'storm'];

describe('parseBalanceArgs', () => {
  it('defaults to every ball, in parallel, with the default seed count', () => {
    expect(parseBalanceArgs([], ids)).toStrictEqual({
      seeds: DEFAULT_SEEDS,
      ballId: undefined,
      serial: false,
      ci: false,
    });
  });

  it('reads a seed count, a ball and --serial in any order', () => {
    expect(parseBalanceArgs(['--ball', 'storm', '200', '--serial'], ids)).toStrictEqual({
      seeds: 200,
      ballId: 'storm',
      serial: true,
      ci: false,
    });
    expect(parseBalanceArgs(['--ball=brawler'], ids)).toMatchObject({ ballId: 'brawler' });
    expect(parseBalanceArgs(['150', '--ci'], ids)).toMatchObject({ seeds: 150, ci: true });
  });

  it.each([
    [['0'], 'positive integer'],
    [['2.5'], 'positive integer'],
    [['ten'], 'positive integer'],
    [['10', '20'], 'at most one'],
    [['--ball', 'titan'], 'Unknown ball "titan"'],
    [['--ball'], 'argument missing'],
    [['--fast'], "Unknown option '--fast'"],
  ])('rejects %j', (args, message) => {
    const result = parseBalanceArgs(args, ids);
    expect(result).toHaveProperty('error');
    expect('error' in result ? result.error : '').toContain(message);
  });
});
