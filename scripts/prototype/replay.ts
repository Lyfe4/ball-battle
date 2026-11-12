// node replay.ts <repoRoot> [trace]
import { pathToFileURL } from 'node:url';
const root = process.argv[2]!;
const trace = process.argv[3] === 'trace';
const imp = (p: string) => import(pathToFileURL(`${root}/src/sim/${p}`).href);
const { BALL_LOOKUP } = await imp('balls/index.ts');
const { playSeries, matchWorld } = await imp('series-verify.ts');
const { step } = await imp('step.ts');
const { RULESET_VERSION } = await imp('ruleset.ts');

const setup = {
  ruleset: RULESET_VERSION,
  seed: 1858974264,
  a: ['ghost', 'venom', 'sniper'],
  b: ['necromancer', 'vampire', 'ghost'],
  opponent: { kind: 'bot', bot: 'hard', lineupSeed: 1858974264 },
  format: 'reveal',
  picks: ['vampire', 'sniper', 'ghost', 'necromancer'],
};
let state;
try {
  state = playSeries(setup, BALL_LOOKUP);
} catch (e) {
  console.log('series invalid under ruleset', RULESET_VERSION, String(e));
  process.exit(0);
}
console.log('ruleset', RULESET_VERSION);
for (const r of state.rounds) console.log(JSON.stringify(r));
const r2 = state.rounds[1];
let world = matchWorld({ round: 1, attempt: 0, seed: r2.seeds[0], a: r2.a, b: r2.b }, BALL_LOOKUP);
let lastContact = 0;
const gaps: [number, number][] = [];
const f = (n: number) => n.toFixed(1).padStart(7);
while (world.match.status === 'running') {
  const { world: next, events } = step(world, BALL_LOOKUP);
  const contact = events.some(
    (e: any) => e.type === 'collision' && e.ballIds.every((id: string) => id.startsWith('ball-')),
  );
  if (contact) {
    if (next.tick - lastContact >= 300) gaps.push([lastContact, next.tick]);
    lastContact = next.tick;
  }
  if (trace) {
    const ev = events
      .filter((e: any) => e.type !== 'abilityTriggered')
      .map((e: any) => e.type + (e.ballIds ? `(${e.ballIds.join('/')})` : '') + (e.cause ? `:${e.cause}` : ''))
      .join(' ');
    const b = next.balls
      .map((x: any) => `${x.definitionId.slice(0, 5)} p(${f(x.position.x)},${f(x.position.y)}) v(${f(x.velocity.x)},${f(x.velocity.y)}) hp${x.health}`)
      .join(' | ');
    const m = next.minions.map((x: any) => `m p(${f(x.position.x)},${f(x.position.y)}) v(${f(x.velocity.x)},${f(x.velocity.y)})`).join(' ');
    console.log(`${String(next.tick).padStart(5)} ${b} ${m} ${ev}`);
  }
  world = next;
}
if (world.tick - lastContact >= 300) gaps.push([lastContact, world.tick]);
console.log('round 2', r2.a, 'vs', r2.b, 'seed', r2.seeds[0], 'ended tick', world.tick, JSON.stringify(world.match));
console.log('no-contact stretches >= 5 s (ticks):', JSON.stringify(gaps));
