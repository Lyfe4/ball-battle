// What a tick sounds like, read from its events and the worlds either side of it, the way the
// effects read them (ADR 0007): pure, and only ever about something the arena draws. The sim never
// knows sound exists. Each ball whose ability has a sound of its own names it here by definition
// id; every other ball is heard through the shared bump, hit and knockout.
import { impactStrength } from '../render/impact.ts';
import { ARENA_SIZE } from '../sim/constants.ts';
import { CAPACITY } from '../sim/balls/battery.ts';
import { hexCurseOf } from '../sim/balls/hex.ts';
import type { BallState, SimEvent, Vec2, WorldState } from '../sim/types.ts';

/** Every sound a fight makes. */
export type FightCue =
  | 'bump'
  | 'hit'
  | 'knockout'
  | 'arrowFire'
  | 'arrowHit'
  | 'curse'
  | 'curseBurst'
  | 'store'
  | 'release'
  | 'split';

export interface Cue {
  readonly kind: FightCue;
  /** 0 (lightest) to 1 (hardest). */
  readonly strength: number;
  /** Left -1 to right 1, from where it happened; kept narrow so a phone speaker still hears it. */
  readonly pan: number;
}

/** How far a sound moves to one side at the arena's edge. */
const PAN_WIDTH = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const panAt = (point: Vec2 | undefined): number =>
  point === undefined ? 0 : ((point.x - ARENA_SIZE / 2) / (ARENA_SIZE / 2)) * PAN_WIDTH;

const byId = (world: WorldState): ReadonlyMap<string, BallState> =>
  new Map(world.balls.map((ball) => [ball.id, ball]));

const kindOf = (balls: ReadonlyMap<string, BallState>, id: string): string | undefined =>
  balls.get(id)?.definitionId;

const stored = (ball: BallState | undefined): number => {
  const value = ball?.abilityState['stored'];
  return typeof value === 'number' ? value : 0;
};

/** The sounds of one tick, in event order. */
export function cuesOf(
  events: readonly SimEvent[],
  previous: WorldState,
  world: WorldState,
): readonly Cue[] {
  const before = byId(previous);
  const after = byId(world);
  const cues: Cue[] = [];
  const add = (kind: FightCue, strength: number, point?: Vec2) => {
    cues.push({ kind, strength: clamp01(strength), pan: panAt(point) });
  };
  // Contact damage per ball this tick: how hard a bump sounds.
  const contact = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'damage' && event.cause === 'contact') {
      contact.set(event.targetId, (contact.get(event.targetId) ?? 0) + event.amount);
    }
  }
  const ended = events.some((event) => event.type === 'matchEnded');

  for (const event of events) {
    switch (event.type) {
      case 'collision': {
        if (event.phased === true) break;
        // A Battery that had stored a hit lets it out on this bump: that is the sound.
        const battery = event.ballIds.find(
          (id) =>
            kindOf(before, id) === 'battery' && stored(before.get(id)) > stored(after.get(id)),
        );
        if (battery !== undefined) {
          add('release', stored(before.get(battery)) / CAPACITY, event.point);
          break;
        }
        const damage = Math.max(...event.ballIds.map((id) => contact.get(id) ?? 0));
        add('bump', impactStrength(damage), event.point);
        break;
      }
      case 'projectileFired':
        if (kindOf(before, event.ownerId) === 'archer') add('arrowFire', 0.5, event.position);
        break;
      case 'projectileHit':
        add(
          kindOf(before, event.ownerId) === 'archer' ? 'arrowHit' : 'hit',
          impactStrength(event.amount),
          event.point,
        );
        break;
      case 'damage':
        if (event.cause === 'ability' && event.via === 'onTick') {
          if (kindOf(before, event.sourceId) === 'hex') {
            add('curseBurst', impactStrength(event.amount), after.get(event.targetId)?.position);
          }
        }
        break;
      case 'zoneStruck':
        if (event.hitIds.length > 0) add('hit', 0.6, event.position);
        break;
      case 'hitReduced':
        if (kindOf(before, event.ballId) === 'battery') {
          add('store', event.reduced / CAPACITY, after.get(event.ballId)?.position);
        }
        break;
      case 'split':
        add('split', 1, event.position);
        break;
      case 'ballDefeated':
        add('knockout', ended ? 1 : 0.6, before.get(event.ballId)?.position);
        break;
      default:
        break;
    }
  }
  // A Hex lays its curse on a bump: heard as the curse appears on the other ball.
  for (const ball of world.balls) {
    if (ball.definitionId !== 'hex') continue;
    const now = hexCurseOf(ball);
    const was = before.get(ball.id);
    const then = was === undefined ? undefined : hexCurseOf(was);
    if (now !== undefined && now.cursedTick !== then?.cursedTick) {
      add('curse', 0.6, after.get(now.cursedId)?.position);
    }
  }
  return cues;
}
