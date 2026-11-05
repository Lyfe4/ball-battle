// Worker thread for fight-stats.ts.
import { parentPort } from 'node:worker_threads';
import { playFights, type FightTask } from './fight-stats-play.ts';
import type { PoolMessage } from './worker-pool.ts';

if (parentPort === null) throw new Error('fight-stats-worker.ts must run as a worker thread');
const port = parentPort;

port.on('message', ({ index, task }: PoolMessage<FightTask>) => {
  port.postMessage({ index, result: playFights(task) });
});
