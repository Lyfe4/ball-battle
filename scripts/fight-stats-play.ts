// Headless fight statistics for the bigger-balls experiment (docs/bigger-balls-experiment.md):
// match length, collisions, and how often projectiles and zones land, per pair, on today's random
// start. Measurement only.
import { BALL_LOOKUP } from '../src/sim/balls/index.ts';
import { getDefinition } from '../src/sim/definitions.ts';
import { MATCH_TIME_LIMIT_TICKS } from '../src/sim/constants.ts';
import { step } from '../src/sim/step.ts';
import { createWorld } from '../src/sim/world.ts';

export interface FightTask {
  readonly p: string;
  readonly q: string;
  readonly firstSeed: number;
  readonly endSeed: number;
}

/** Per ball of the pair (index 0 = p, 1 = q). */
export interface Shots {
  fired: number;
  hit: number;
  zones: number;
  zoneHits: number;
}

export interface FightResult {
  readonly lengths: number[];
  collisions: number;
  timeouts: number;
  readonly shots: [Shots, Shots];
}

const emptyShots = (): Shots => ({ fired: 0, hit: 0, zones: 0, zoneHits: 0 });

/** Plays p vs q in both slot orders over the seed range. */
export function playFights(task: FightTask): FightResult {
  const result: FightResult = {
    lengths: [],
    collisions: 0,
    timeouts: 0,
    shots: [emptyShots(), emptyShots()],
  };
  for (let seed = task.firstSeed; seed < task.endSeed; seed++) {
    for (const pSlot of [0, 1] as const) {
      const ids = pSlot === 0 ? [task.p, task.q] : [task.q, task.p];
      let world = createWorld(
        seed,
        ids.map((id) => getDefinition(BALL_LOOKUP, id)),
      );
      // Which entry of result.shots a ball id belongs to.
      const side = (ballId: string) => (ballId === `ball-${pSlot}` ? 0 : 1);
      while (world.match.status === 'running') {
        const { world: next, events } = step(world, BALL_LOOKUP);
        world = next;
        for (const event of events) {
          if (event.type === 'collision') result.collisions++;
          else if (event.type === 'projectileFired') result.shots[side(event.ownerId)].fired++;
          else if (event.type === 'projectileHit') result.shots[side(event.ownerId)].hit++;
          else if (event.type === 'zoneStruck') {
            const shots = result.shots[side(event.ownerId)];
            shots.zones++;
            if (event.hitIds.length > 0) shots.zoneHits++;
          }
        }
      }
      // The loop only ends on a finished match, which carries its end tick.
      const { endTick } = world.match;
      result.lengths.push(endTick);
      if (endTick >= MATCH_TIME_LIMIT_TICKS) result.timeouts++;
    }
  }
  return result;
}
