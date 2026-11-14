import { describe, expect, it } from 'vitest';
import { WHOLE_RUN_TIMEOUT_MS } from '../src/sim/test-support.ts';
import { runJob, splitJobs, type PairJob } from './balance-jobs.ts';
import { mergePairResults, type PairResult } from './balance-stats.ts';

const job = (x: string, y: string, seeds: number, xHealth = 1): PairJob => ({
  x,
  y,
  xHealth,
  yHealth: 1,
  seeds,
});

/** Lengths are only ever used through median, so compare them as a sorted list. */
const comparable = (result: PairResult) => ({
  ...result,
  lengths: [...result.lengths].sort((a, b) => a - b),
});

describe('balance jobs', () => {
  it('splits every job into seed slices that cover each seed exactly once', () => {
    const jobs = [job('brawler', 'storm', 10), job('archer', 'archer', 10)];
    const tasks = splitJobs(jobs, 3);
    expect(tasks.map((task) => task.index)).toStrictEqual(tasks.map((_, index) => index));
    for (const each of jobs) {
      const slices = tasks.filter((task) => task.job === each);
      expect(slices.length).toBeGreaterThan(1);
      expect(slices[0]?.firstSeed).toBe(0);
      expect(slices.at(-1)?.endSeed).toBe(10);
      slices.slice(1).forEach((slice, i) => {
        expect(slice.firstSeed).toBe(slices[i]?.endSeed);
      });
    }
  });

  it('never makes more slices than seeds', () => {
    expect(splitJobs([job('brawler', 'storm', 2)], 16)).toHaveLength(2);
  });

  it(
    'gives the same result for a job played in slices as in one go',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    () => {
      for (const each of [
        job('speedster', 'vampire', 6),
        job('storm', 'storm', 6),
        job('archer', 'brawler', 6, 1.05),
      ]) {
        const whole = runJob(each);
        const sliced = mergePairResults([
          runJob(each, 0, 2),
          runJob(each, 2, 5),
          runJob(each, 5, 6),
        ]);
        expect(comparable(sliced)).toStrictEqual(comparable(whole));
        expect(whole.games).toBe(each.x === each.y ? 6 : 12);
      }
    },
  );

  it('plays a sensitivity job with the nudged max health', () => {
    const base = runJob(job('brawler', 'vampire', 8));
    const nudged = runJob(job('brawler', 'vampire', 8, 0.5));
    // Half the health loses far more often; the exact numbers don't matter here.
    expect(nudged.wins[0]).toBeLessThan(base.wins[0]);
  });
});
