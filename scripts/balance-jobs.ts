// The work `pnpm balance` does, split into independent jobs that can run on worker threads. Each
// job plays one pair of balls over every seed with the real simulation, so a job gives the same
// result on any thread, and results are put back in job order: parallel output equals serial.
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { BALLS } from '../src/sim/balls/index.ts';
import type { BallDefinition } from '../src/sim/types.ts';
import { mergePairResults, playPair, withMaxHealth, type PairResult } from './balance-stats.ts';

/** One pair played over every seed. Plain data, so it can be posted to a worker. */
export interface PairJob {
  readonly x: string;
  readonly y: string;
  /** Max-health factors for sensitivity runs; 1 leaves the ball unchanged. */
  readonly xHealth: number;
  readonly yHealth: number;
  readonly seeds: number;
}

function definition(id: string, healthFactor: number): BallDefinition {
  const ball = BALLS.find((candidate) => candidate.id === id);
  if (ball === undefined) throw new Error(`Unknown ball "${id}"`);
  return healthFactor === 1 ? ball : withMaxHealth(ball, healthFactor);
}

/**
 * Plays one job on this thread, on seeds firstSeed..endSeed-1 (all of them by default). A mirror
 * passes the same definition twice (see playPair).
 */
export function runJob(job: PairJob, firstSeed = 0, endSeed = job.seeds): PairResult {
  const x = definition(job.x, job.xHealth);
  const y = job.x === job.y && job.yHealth === job.xHealth ? x : definition(job.y, job.yHealth);
  return playPair(x, y, endSeed, BALLS, firstSeed);
}

/** A slice of one job's seeds, the unit a worker plays. */
export interface Task {
  readonly index: number;
  readonly job: PairJob;
  readonly firstSeed: number;
  readonly endSeed: number;
}

interface Reply {
  readonly index: number;
  readonly result: PairResult;
}

/** Tasks per worker to aim for, so uneven jobs still keep every core busy until the end. */
const TASKS_PER_WORKER = 4;

/** Splits jobs into seed ranges: every job into the same number of near-equal slices. */
export function splitJobs(jobs: readonly PairJob[], workers: number): readonly Task[] {
  const tasks: Task[] = [];
  jobs.forEach((job) => {
    const slices = Math.max(
      1,
      Math.min(job.seeds, Math.ceil((workers * TASKS_PER_WORKER) / jobs.length)),
    );
    for (let slice = 0; slice < slices; slice++) {
      const firstSeed = Math.floor((job.seeds * slice) / slices);
      const endSeed = Math.floor((job.seeds * (slice + 1)) / slices);
      tasks.push({ index: tasks.length, job, firstSeed, endSeed });
    }
  });
  return tasks;
}

/**
 * Runs every job, sliced by seed across worker threads (one per core) unless `serial`, and
 * returns the results in job order. Slices merge exactly (see mergePairResults), so the output
 * is the same either way.
 */
export async function runJobs(
  jobs: readonly PairJob[],
  serial: boolean,
): Promise<readonly PairResult[]> {
  if (serial) return jobs.map((job) => runJob(job));

  const workerCount = availableParallelism();
  const tasks = splitJobs(jobs, workerCount);
  const results: (PairResult | undefined)[] = tasks.map(() => undefined);
  let next = 0;
  const workers = Array.from({ length: workerCount }, () => {
    const worker = new Worker(new URL('./balance-worker.ts', import.meta.url));
    return new Promise<void>((resolve, reject) => {
      const feed = (): void => {
        const task = tasks[next++];
        if (task === undefined) {
          void worker.terminate().then(() => {
            resolve();
          });
          return;
        }
        worker.postMessage(task);
      };
      worker.on('message', ({ index, result }: Reply) => {
        results[index] = result;
        feed();
      });
      worker.on('error', reject);
      feed();
    });
  });
  await Promise.all(workers);
  return jobs.map((job) =>
    mergePairResults(
      tasks
        .filter((task) => task.job === job)
        .map((task) => {
          const result = results[task.index];
          if (result === undefined) throw new Error(`Task ${task.index} returned no result`);
          return result;
        }),
    ),
  );
}
