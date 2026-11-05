// Worker thread for the aiming measurements: plays each task it is sent and posts the result back.
import { parentPort } from 'node:worker_threads';
import { playTask, type AimTask } from './aim-play.ts';
import type { PoolMessage } from './worker-pool.ts';

if (parentPort === null) throw new Error('aim-worker.ts must run as a worker thread');
const port = parentPort;

port.on('message', ({ index, task }: PoolMessage<AimTask>) => {
  port.postMessage({ index, result: playTask(task) });
});
