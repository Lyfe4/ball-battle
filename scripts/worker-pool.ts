// A small worker-thread pool for headless measurement scripts: one worker per core, each fed the
// next task as soon as it posts a result. Results come back in task order, so output never
// depends on scheduling. (`pnpm balance` has its own job runner in balance-jobs.ts.)
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

export interface PoolMessage<T> {
  readonly index: number;
  readonly task: T;
}

export interface PoolReply<R> {
  readonly index: number;
  readonly result: R;
}

/** Runs every task on `workerUrl` workers and returns the results in task order. */
export async function runPool<R>(
  workerUrl: URL,
  tasks: readonly unknown[],
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: (R | undefined)[] = tasks.map(() => undefined);
  let next = 0;
  let done = 0;
  const workerCount = Math.min(availableParallelism(), Math.max(1, tasks.length));
  await Promise.all(
    Array.from({ length: workerCount }, () => {
      const worker = new Worker(workerUrl);
      return new Promise<void>((resolve, reject) => {
        const feed = (): void => {
          const index = next++;
          const task = tasks[index];
          if (task === undefined) {
            void worker.terminate().then(() => {
              resolve();
            });
            return;
          }
          worker.postMessage({ index, task } satisfies PoolMessage<unknown>);
        };
        worker.on('message', ({ index, result }: PoolReply<R>) => {
          results[index] = result;
          onProgress?.(++done, tasks.length);
          feed();
        });
        worker.on('error', reject);
        feed();
      });
    }),
  );
  return results.map((result, index) => {
    if (result === undefined) throw new Error(`Task ${index} returned no result`);
    return result;
  });
}
