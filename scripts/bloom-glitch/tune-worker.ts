import { parentPort } from 'node:worker_threads';
import { playPair } from '../balance-stats.ts';
import { glitchProto } from '../../src/sim/glitch.ts';
import { rosterOf, type Variant } from './variants.ts';

interface Task {
  readonly x: string;
  readonly y: string;
  readonly variant: Variant;
  readonly first: number;
  readonly end: number;
}
const port = parentPort;
if (port === null) throw new Error('worker only');
port.on('message', ({ index, task }: { index: number; task: Task }) => {
  glitchProto.keepSizeHit = task.variant.proto?.keepSizeHit ?? true;
  const roster = rosterOf(task.variant);
  const x = roster.find((b) => b.id === task.x);
  const y = roster.find((b) => b.id === task.y);
  if (!x || !y) throw new Error('unknown ball');
  const r = playPair(x, y, task.end, roster, task.first);
  const sorted = [...r.lengths].sort((a, b) => a - b);
  port.postMessage({
    index,
    result: {
      wins: r.wins,
      draws: r.draws,
      games: r.games,
      comebacks: r.comebacks,
      lengthSum: sorted.reduce((a, b) => a + b, 0),
      lengths: r.lengths,
      healed: [r.totals[0].healed, r.totals[1].healed],
    },
  });
});
