// Every online flow runs on exactly one CI shard, and the shards stay about even (online-shards.ts).
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ONLINE_SHARDS, shardFiles } from './online-shards.ts';

const flows = readdirSync('src/flows').filter((name) => name.endsWith('.online.test.ts'));
const sharded = ONLINE_SHARDS.flat().map(([file]) => file);

describe('the online shards', () => {
  it('run every online flow, each on one shard', () => {
    expect([...sharded].sort()).toStrictEqual([...flows].sort());
    expect(new Set(sharded).size).toBe(sharded.length);
  });

  it('are three, as the CI matrix runs', () => {
    expect(ONLINE_SHARDS).toHaveLength(3);
  });

  it('split the measured time about evenly: no shard over 10% above the mean', () => {
    const totals = ONLINE_SHARDS.map((shard) => shard.reduce((sum, [, s]) => sum + s, 0));
    const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length;
    for (const total of totals) expect(total).toBeLessThan(mean * 1.1);
  });

  it('names paths vitest takes, and refuses a shard that isn’t there', () => {
    expect(shardFiles(2)[0]).toBe('src/flows/live-match.online.test.ts');
    expect(() => shardFiles(4)).toThrow();
  });
});
