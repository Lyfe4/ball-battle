// Worker thread for `pnpm balance`: plays the jobs it is sent and posts each result back.
import { parentPort } from 'node:worker_threads';
import { runJob, type Task } from './balance-jobs.ts';

if (parentPort === null) throw new Error('balance-worker.ts must run as a worker thread');
const port = parentPort;

port.on('message', ({ index, job, firstSeed, endSeed }: Task) => {
  port.postMessage({ index, result: runJob(job, firstSeed, endSeed) });
});
