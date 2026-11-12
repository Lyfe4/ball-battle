// Worker: plays p vs q (both slot orders) over a seed range against the sim at `root`, and
// measures stretches with no ball-to-ball contact and with no damage at all.
import { parentPort } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';

interface Task {
  root: string;
  p: string;
  q: string;
  firstSeed: number;
  endSeed: number;
}

const cache = new Map<string, any>();
async function sim(root: string) {
  let s = cache.get(root);
  if (s === undefined) {
    const imp = (p: string) => import(pathToFileURL(`${root}/src/sim/${p}`).href);
    const [{ BALL_LOOKUP }, { getDefinition }, { step }, { createWorld }] = await Promise.all([
      imp('balls/index.ts'),
      imp('definitions.ts'),
      imp('step.ts'),
      imp('world.ts'),
    ]);
    s = { BALL_LOOKUP, getDefinition, step, createWorld };
    cache.set(root, s);
  }
  return s;
}

const GAP = 300; // 5 s
const AXIS = 0.17364817766693033; // sin 10Â°: within 10Â° of an axis

parentPort!.on('message', async ({ index, task }: { index: number; task: Task }) => {
  const { BALL_LOOKUP, getDefinition, step, createWorld } = await sim(task.root);
  const out = {
    games: 0,
    ticks: 0,
    contacts: 0,
    // Per game: the longest stretch without contact, and without any damage.
    longestContact: [] as number[],
    longestQuiet: [] as number[],
    lengths: [] as number[],
    winsP: 0,
    draws: 0,
    gapsContact: 0, // stretches >= 5 s
    ticksInGaps: 0,
    gapsQuiet: 0,
    // Heading: ticks where both balls are within 10Â° of an axis, overall and inside long gaps.
    bothAxisTicks: 0,
    bothAxisInGap: 0,
    sameWayTicks: 0,
    sameAxisTicks: 0,
    sameAxisIn5: 0,
    sameAxisIn15: 0,
    ticksIn15: 0,
    gaps15: 0,
    timeouts: 0,
    sameWayInGap: 0,
    worst: { ticks: 0, seed: 0, pSlot: 0 },
  };
  for (let seed = task.firstSeed; seed < task.endSeed; seed++) {
    for (const pSlot of [0, 1]) {
      const ids = pSlot === 0 ? [task.p, task.q] : [task.q, task.p];
      let world = createWorld(seed, ids.map((id: string) => getDefinition(BALL_LOOKUP, id)));
      let lastContact = 0;
      let lastDamage = 0;
      let longestC = 0;
      let longestQ = 0;
      let axisSince = 0; // both-axis ticks since the last contact
      let sameSince = 0;
      let sameAxisSince = 0;
      const close = (now: number) => {
        const gap = now - lastContact;
        if (gap > longestC) longestC = gap;
        if (gap >= GAP) {
          out.gapsContact++;
          out.ticksInGaps += gap;
          out.bothAxisInGap += axisSince;
          out.sameWayInGap += sameSince;
          out.sameAxisIn5 += sameAxisSince;
          if (gap >= 900) { out.gaps15++; out.ticksIn15 += gap; out.sameAxisIn15 += sameAxisSince; }
          if (gap > out.worst.ticks) out.worst = { ticks: gap, seed, pSlot };
        }
      };
      while (world.match.status === 'running') {
        const { world: next, events } = step(world, BALL_LOOKUP);
        let contact = false;
        let damage = false;
        for (const e of events) {
          if (e.type === 'collision' && e.ballIds[0].startsWith('ball-') && e.ballIds[1].startsWith('ball-'))
            contact = true;
          else if (e.type === 'damage' && e.amount > 0) damage = true;
        }
        const live = next.balls.filter((b: any) => b.health > 0);
        if (live.length === 2) {
          const axisy = live.every((b: any) => {
            const s = Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y);
            return Math.abs(b.velocity.x) < AXIS * s || Math.abs(b.velocity.y) < AXIS * s;
          });
          const [a, b] = live;
          const va = a.velocity, vb = b.velocity;
          const n = Math.sqrt((va.x * va.x + va.y * va.y) * (vb.x * vb.x + vb.y * vb.y));
          // heading the same way, within 15°
          if (va.x * vb.x + va.y * vb.y > 0.9659258262890683 * n) {
            out.sameWayTicks++;
            sameSince++;
          }
          const S15 = 0.25881904510252074; // sin 15°
          const sa = Math.sqrt(va.x * va.x + va.y * va.y), sb = Math.sqrt(vb.x * vb.x + vb.y * vb.y);
          const horiz = Math.abs(va.y) < S15 * sa && Math.abs(vb.y) < S15 * sb;
          const vert = Math.abs(va.x) < S15 * sa && Math.abs(vb.x) < S15 * sb;
          if (horiz || vert) { out.sameAxisTicks++; sameAxisSince++; }
          if (axisy) {
            out.bothAxisTicks++;
            axisSince++;
          }
        }
        if (contact) {
          out.contacts++;
          close(next.tick);
          lastContact = next.tick;
          axisSince = 0;
          sameSince = 0;
          sameAxisSince = 0;
        }
        if (contact || damage) {
          const q = next.tick - lastDamage;
          if (q > longestQ) longestQ = q;
          if (q >= GAP) out.gapsQuiet++;
          lastDamage = next.tick;
        }
        world = next;
      }
      close(world.tick);
      const q = world.tick - lastDamage;
      if (q > longestQ) longestQ = q;
      if (q >= GAP) out.gapsQuiet++;
      out.games++;
      if (world.match.endTick >= 3600) out.timeouts++;
      out.ticks += world.tick;
      out.lengths.push(world.tick);
      out.longestContact.push(longestC);
      out.longestQuiet.push(longestQ);
      const r = world.match.result;
      if (r.kind === 'draw') out.draws++;
      else if (r.winnerId === `ball-${pSlot}`) out.winsP++;
    }
  }
  parentPort!.postMessage({ index, result: out });
});
